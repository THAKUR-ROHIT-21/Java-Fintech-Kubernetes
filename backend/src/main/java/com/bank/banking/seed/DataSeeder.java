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
 * so re-running on an existing database only fills in whatever is missing â€”
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
                "Salary â€” Northwind Pvt Ltd", Instant.now().minus(1, ChronoUnit.DAYS));

        seedTx(current, "TXN-88147-D", TransactionType.WITHDRAWAL,
                new BigDecimal("1860.00"), current.getBalance(),
                "Electricity Bill â€” BSES", Instant.now().minus(3, ChronoUnit.DAYS));

        seedTx(current, "TXN-88099-D", TransactionType.TRANSFER_OUT,
                new BigDecimal("12000.00"), current.getBalance(),
                "Transfer to Rohan Mehta", Instant.now().minus(4, ChronoUnit.DAYS));

        seedTx(savings, "TXN-87960-C", TransactionType.DEPOSIT,
                new BigDecimal("2499.00"), savings.getBalance(),
                "Refund â€” Amazon", Instant.now().minus(5, ChronoUnit.DAYS));

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

