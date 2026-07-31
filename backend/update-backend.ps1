# Ledgerline backend update script
# Run this from inside the backend\ folder
Write-Host 'Updating backend files...' -ForegroundColor Cyan

New-Item -ItemType Directory -Force -Path (Split-Path 'src\main\java\com\bank\banking\dto\AuthResponse.java') | Out-Null
@'
package com.bank.banking.dto;

import com.bank.banking.entity.Role;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthResponse {
    private String token;
    private String tokenType;
    private Long userId;
    private String fullName;
    private String email;
    private Role role;
}

'@ | Out-File -Encoding utf8 'src\main\java\com\bank\banking\dto\AuthResponse.java'
Write-Host '  wrote src\main\java\com\bank\banking\dto\AuthResponse.java'

New-Item -ItemType Directory -Force -Path (Split-Path 'src\main\java\com\bank\banking\dto\CustomerAccountResponse.java') | Out-Null
@'
package com.bank.banking.dto;

import com.bank.banking.entity.AccountStatus;
import com.bank.banking.entity.AccountType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Admin-only view of one account, including the owning customer's identity —
 * a plain AccountResponse deliberately never includes this since a customer
 * should only ever see their own accounts, not who else owns what.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CustomerAccountResponse {
    private Long accountId;
    private String accountNumber;
    private AccountType type;
    private AccountStatus status;
    private BigDecimal balance;
    private Instant accountCreatedAt;

    private Long customerId;
    private String customerName;
    private String customerEmail;
    private String customerPhone;
}

'@ | Out-File -Encoding utf8 'src\main\java\com\bank\banking\dto\CustomerAccountResponse.java'
Write-Host '  wrote src\main\java\com\bank\banking\dto\CustomerAccountResponse.java'

New-Item -ItemType Directory -Force -Path (Split-Path 'src\main\java\com\bank\banking\service\AuthService.java') | Out-Null
@'
package com.bank.banking.service;

import com.bank.banking.dto.AuthResponse;
import com.bank.banking.dto.LoginRequest;
import com.bank.banking.dto.RegisterRequest;
import com.bank.banking.entity.Account;
import com.bank.banking.entity.AccountType;
import com.bank.banking.entity.Role;
import com.bank.banking.entity.User;
import com.bank.banking.exception.EmailAlreadyExistsException;
import com.bank.banking.repository.AccountRepository;
import com.bank.banking.repository.UserRepository;
import com.bank.banking.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.security.SecureRandom;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final AccountRepository accountRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;

    private static final SecureRandom RANDOM = new SecureRandom();

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new EmailAlreadyExistsException("An account with this email already exists");
        }

        User user = User.builder()
                .fullName(request.getFullName())
                .email(request.getEmail())
                .phone(request.getPhone())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(Role.CUSTOMER)
                .build();
        user = userRepository.save(user);

        // Every new customer gets a savings account opened automatically, zero balance.
        Account savings = Account.builder()
                .accountNumber(generateAccountNumber())
                .owner(user)
                .type(AccountType.SAVINGS)
                .balance(BigDecimal.ZERO)
                .build();
        accountRepository.save(savings);

        String token = jwtService.generateToken(toUserDetails(user));

        return AuthResponse.builder()
                .token(token)
                .tokenType("Bearer")
                .userId(user.getId())
                .fullName(user.getFullName())
                .email(user.getEmail())
                .role(user.getRole())
                .build();
    }

    public AuthResponse login(LoginRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
        );

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new org.springframework.security.authentication.BadCredentialsException("Incorrect email or password"));

        String token = jwtService.generateToken(toUserDetails(user));

        return AuthResponse.builder()
                .token(token)
                .tokenType("Bearer")
                .userId(user.getId())
                .fullName(user.getFullName())
                .email(user.getEmail())
                .role(user.getRole())
                .build();
    }

    private UserDetails toUserDetails(User user) {
        return org.springframework.security.core.userdetails.User.builder()
                .username(user.getEmail())
                .password(user.getPasswordHash())
                .authorities("ROLE_" + user.getRole().name())
                .build();
    }

    private String generateAccountNumber() {
        // 12-digit account number, prefixed so it's visually distinct from phone numbers etc.
        StringBuilder sb = new StringBuilder("42");
        for (int i = 0; i < 10; i++) {
            sb.append(RANDOM.nextInt(10));
        }
        return sb.toString();
    }
}

'@ | Out-File -Encoding utf8 'src\main\java\com\bank\banking\service\AuthService.java'
Write-Host '  wrote src\main\java\com\bank\banking\service\AuthService.java'

New-Item -ItemType Directory -Force -Path (Split-Path 'src\main\java\com\bank\banking\service\AdminService.java') | Out-Null
@'
package com.bank.banking.service;

import com.bank.banking.dto.CustomerAccountResponse;
import com.bank.banking.entity.Account;
import com.bank.banking.repository.AccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminService {

    private final AccountRepository accountRepository;

    /**
     * Returns every account in the bank along with its owner's identity.
     * Only reachable by ROLE_ADMIN — enforced in SecurityConfig, not here,
     * so this stays a plain data-access method with no auth logic mixed in.
     *
     * @Transactional(readOnly = true) keeps the Hibernate session open long
     * enough to read the lazily-loaded Account.owner association below —
     * without it this throws LazyInitializationException, since open-in-view
     * is disabled.
     */
    @Transactional(readOnly = true)
    public List<CustomerAccountResponse> getAllAccounts() {
        return accountRepository.findAll().stream()
                .sorted(Comparator.comparing(Account::getId))
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    private CustomerAccountResponse toResponse(Account account) {
        return CustomerAccountResponse.builder()
                .accountId(account.getId())
                .accountNumber(account.getAccountNumber())
                .type(account.getType())
                .status(account.getStatus())
                .balance(account.getBalance())
                .accountCreatedAt(account.getCreatedAt())
                .customerId(account.getOwner().getId())
                .customerName(account.getOwner().getFullName())
                .customerEmail(account.getOwner().getEmail())
                .customerPhone(account.getOwner().getPhone())
                .build();
    }
}

'@ | Out-File -Encoding utf8 'src\main\java\com\bank\banking\service\AdminService.java'
Write-Host '  wrote src\main\java\com\bank\banking\service\AdminService.java'

New-Item -ItemType Directory -Force -Path (Split-Path 'src\main\java\com\bank\banking\controller\AdminController.java') | Out-Null
@'
package com.bank.banking.controller;

import com.bank.banking.dto.CustomerAccountResponse;
import com.bank.banking.service.AdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;

    // Route-level restriction lives in SecurityConfig (/api/admin/** -> hasRole("ADMIN")),
    // this endpoint itself stays simple.
    @GetMapping("/accounts")
    public ResponseEntity<List<CustomerAccountResponse>> getAllAccounts() {
        return ResponseEntity.ok(adminService.getAllAccounts());
    }
}

'@ | Out-File -Encoding utf8 'src\main\java\com\bank\banking\controller\AdminController.java'
Write-Host '  wrote src\main\java\com\bank\banking\controller\AdminController.java'

New-Item -ItemType Directory -Force -Path (Split-Path 'src\main\java\com\bank\banking\config\SecurityConfig.java') | Out-Null
@'
package com.bank.banking.config;

import com.bank.banking.security.JwtAuthFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final UserDetailsServiceImpl userDetailsService;
    private final JwtAuthFilter jwtAuthFilter;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public DaoAuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers("/actuator/health").permitAll()
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .anyRequest().authenticated()
                )
                .authenticationProvider(authenticationProvider())
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of("http://localhost:5173"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}

'@ | Out-File -Encoding utf8 'src\main\java\com\bank\banking\config\SecurityConfig.java'
Write-Host '  wrote src\main\java\com\bank\banking\config\SecurityConfig.java'

New-Item -ItemType Directory -Force -Path (Split-Path 'src\main\java\com\bank\banking\seed\DataSeeder.java') | Out-Null
@'
package com.bank.banking.seed;

import com.bank.banking.entity.*;
import com.bank.banking.repository.AccountRepository;
import com.bank.banking.repository.TransactionRepository;
import com.bank.banking.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

/**
 * Seeds a demo customer (with two accounts + transactions) and a demo admin
 * user. Each seed step checks independently whether its user already exists,
 * so re-running on an existing database only fills in whatever is missing —
 * safe to run on every restart.
 */
@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final AccountRepository accountRepository;
    private final TransactionRepository transactionRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public void run(String... args) {
        seedDemoCustomer();
        seedAdmin();
    }

    private void seedDemoCustomer() {
        if (userRepository.existsByEmail("dev@ledgerline.app")) {
            return;
        }

        User dev = User.builder()
                .fullName("Dev Verma")
                .email("dev@ledgerline.app")
                .phone("9876543210")
                .passwordHash(passwordEncoder.encode("password123"))
                .role(Role.CUSTOMER)
                .build();
        dev = userRepository.save(dev);

        Account savings = Account.builder()
                .accountNumber("428214290004821")
                .owner(dev)
                .type(AccountType.SAVINGS)
                .status(AccountStatus.ACTIVE)
                .balance(new BigDecimal("1842904.00"))
                .build();
        savings = accountRepository.save(savings);

        Account current = Account.builder()
                .accountNumber("428264620007710")
                .owner(dev)
                .type(AccountType.CURRENT)
                .status(AccountStatus.ACTIVE)
                .balance(new BigDecimal("646200.00"))
                .build();
        current = accountRepository.save(current);

        seedTx(current, "TXN-88213-D", TransactionType.TRANSFER_OUT,
                new BigDecimal("4200.00"), current.getBalance(),
                "Transfer to Aditi Rao", Instant.now().minus(2, ChronoUnit.HOURS));

        seedTx(savings, "TXN-88190-C", TransactionType.DEPOSIT,
                new BigDecimal("86000.00"), savings.getBalance(),
                "Salary — Northwind Pvt Ltd", Instant.now().minus(1, ChronoUnit.DAYS));

        seedTx(current, "TXN-88147-D", TransactionType.WITHDRAWAL,
                new BigDecimal("1860.00"), current.getBalance(),
                "Electricity Bill — BSES", Instant.now().minus(3, ChronoUnit.DAYS));

        seedTx(current, "TXN-88099-D", TransactionType.TRANSFER_OUT,
                new BigDecimal("12000.00"), current.getBalance(),
                "Transfer to Rohan Mehta", Instant.now().minus(4, ChronoUnit.DAYS));

        seedTx(savings, "TXN-87960-C", TransactionType.DEPOSIT,
                new BigDecimal("2499.00"), savings.getBalance(),
                "Refund — Amazon", Instant.now().minus(5, ChronoUnit.DAYS));

        System.out.println("Seeded demo customer: dev@ledgerline.app / password123");
    }

    private void seedAdmin() {
        if (userRepository.existsByEmail("admin@ledgerline.app")) {
            return;
        }

        User admin = User.builder()
                .fullName("Ledgerline Admin")
                .email("admin@ledgerline.app")
                .phone("9999999999")
                .passwordHash(passwordEncoder.encode("admin123"))
                .role(Role.ADMIN)
                .build();
        userRepository.save(admin);

        System.out.println("Seeded admin user: admin@ledgerline.app / admin123");
    }

    private void seedTx(Account account, String reference, TransactionType type,
                         BigDecimal amount, BigDecimal balanceAfter, String description, Instant createdAt) {
        Transaction tx = Transaction.builder()
                .reference(reference)
                .account(account)
                .type(type)
                .status(TransactionStatus.COMPLETED)
                .amount(amount)
                .balanceAfter(balanceAfter)
                .description(description)
                .build();
        tx.setCreatedAt(createdAt);
        transactionRepository.save(tx);
    }
}

'@ | Out-File -Encoding utf8 'src\main\java\com\bank\banking\seed\DataSeeder.java'
Write-Host '  wrote src\main\java\com\bank\banking\seed\DataSeeder.java'

New-Item -ItemType Directory -Force -Path (Split-Path 'src\main\java\com\bank\banking\exception\GlobalExceptionHandler.java') | Out-Null
@'
package com.bank.banking.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private Map<String, Object> body(HttpStatus status, String message) {
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", Instant.now().toString());
        body.put("status", status.value());
        body.put("error", status.getReasonPhrase());
        body.put("message", message);
        return body;
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<?> handleNotFound(ResourceNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(body(HttpStatus.NOT_FOUND, ex.getMessage()));
    }

    @ExceptionHandler(InsufficientFundsException.class)
    public ResponseEntity<?> handleInsufficientFunds(InsufficientFundsException ex) {
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(body(HttpStatus.UNPROCESSABLE_ENTITY, ex.getMessage()));
    }

    @ExceptionHandler(AccountFrozenException.class)
    public ResponseEntity<?> handleFrozen(AccountFrozenException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(body(HttpStatus.FORBIDDEN, ex.getMessage()));
    }

    @ExceptionHandler(EmailAlreadyExistsException.class)
    public ResponseEntity<?> handleEmailExists(EmailAlreadyExistsException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(body(HttpStatus.CONFLICT, ex.getMessage()));
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<?> handleBadCredentials(BadCredentialsException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(body(HttpStatus.UNAUTHORIZED, "Incorrect email or password"));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<?> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> fieldErrors = new HashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(err ->
                fieldErrors.put(err.getField(), err.getDefaultMessage()));

        Map<String, Object> body = body(HttpStatus.BAD_REQUEST, "Validation failed");
        body.put("fields", fieldErrors);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<?> handleGeneric(Exception ex) {
        // TODO: replace with a proper logger before shipping; printing here for local debugging
        ex.printStackTrace();
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(body(HttpStatus.INTERNAL_SERVER_ERROR, "Something went wrong. Please try again."));
    }
}

'@ | Out-File -Encoding utf8 'src\main\java\com\bank\banking\exception\GlobalExceptionHandler.java'
Write-Host '  wrote src\main\java\com\bank\banking\exception\GlobalExceptionHandler.java'

Write-Host 'Done. Now run:  mvn clean package -DskipTests' -ForegroundColor Green