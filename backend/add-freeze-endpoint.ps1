# Ledgerline: adds POST /api/accounts/{id}/toggle-freeze
Write-Host 'Adding freeze toggle endpoint...' -ForegroundColor Cyan

New-Item -ItemType Directory -Force -Path (Split-Path 'src\main\java\com\bank\banking\service\AccountService.java') | Out-Null
@'
package com.bank.banking.service;

import com.bank.banking.dto.AccountLookupResponse;
import com.bank.banking.dto.AccountResponse;
import com.bank.banking.entity.Account;
import com.bank.banking.entity.AccountStatus;
import com.bank.banking.entity.AccountType;
import com.bank.banking.entity.User;
import com.bank.banking.exception.ResourceNotFoundException;
import com.bank.banking.repository.AccountRepository;
import com.bank.banking.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AccountService {

    private final AccountRepository accountRepository;
    private final UserRepository userRepository;

    private static final SecureRandom RANDOM = new SecureRandom();

    public List<AccountResponse> getMyAccounts(Authentication authentication) {
        User user = currentUser(authentication);
        return accountRepository.findByOwnerId(user.getId()).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public User currentUser(Authentication authentication) {
        String email = authentication.getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    /**
     * Opens a new account of the given type for the current user. Each user
     * may hold at most one SAVINGS and one CURRENT account — this keeps the
     * dashboard's "Savings · Current" summary meaningful without needing to
     * handle an arbitrary number of same-type accounts in the UI.
     */
    @Transactional
    public AccountResponse openAccount(AccountType type, Authentication authentication) {
        User user = currentUser(authentication);

        boolean alreadyHasType = accountRepository.findByOwnerId(user.getId()).stream()
                .anyMatch(a -> a.getType() == type);
        if (alreadyHasType) {
            throw new IllegalArgumentException(
                    "You already have a " + (type == AccountType.SAVINGS ? "savings" : "current") + " account");
        }

        Account account = Account.builder()
                .accountNumber(generateAccountNumber())
                .owner(user)
                .type(type)
                .status(AccountStatus.ACTIVE)
                .balance(BigDecimal.ZERO)
                .build();

        return toResponse(accountRepository.save(account));
    }

    private String generateAccountNumber() {
        // Same 12-digit format as new-signup accounts: fixed 4282 bank prefix
        // + 8 random digits.
        StringBuilder sb = new StringBuilder("4282");
        for (int i = 0; i < 8; i++) {
            sb.append(RANDOM.nextInt(10));
        }
        return sb.toString();
    }

    /**
     * Looks up a recipient by account number for the "confirm before you send"
     * step in the transfer flow. See AccountLookupResponse for why this
     * deliberately returns only name / type / a masked phone — never balance,
     * status, or the full phone number.
     *
     * @Transactional(readOnly = true) because Account.owner is lazy-loaded.
     */
    @Transactional(readOnly = true)
    public AccountLookupResponse lookupByAccountNumber(String accountNumber) {
        Account account = accountRepository.findByAccountNumber(accountNumber)
                .orElseThrow(() -> new ResourceNotFoundException("No account found with that number"));

        return AccountLookupResponse.builder()
                .accountNumber(account.getAccountNumber())
                .type(account.getType())
                .ownerName(account.getOwner().getFullName())
                .maskedPhone(maskPhone(account.getOwner().getPhone()))
                .build();
    }

    private String maskPhone(String phone) {
        if (phone == null || phone.length() < 4) return "••••••";
        return "••••••" + phone.substring(phone.length() - 4);
    }

    /**
     * Freezes or unfreezes one of the current user's own accounts. Deposits
     * and transfers already check AccountStatus.FROZEN and reject with
     * AccountFrozenException, so flipping this one field is enough to
     * actually block money movement — no other service needs to change.
     */
    @Transactional
    public AccountResponse toggleFreeze(Long accountId, Authentication authentication) {
        User user = currentUser(authentication);

        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new ResourceNotFoundException("Account not found"));

        if (!account.getOwner().getId().equals(user.getId())) {
            throw new ResourceNotFoundException("Account not found");
        }

        account.setStatus(account.getStatus() == AccountStatus.FROZEN
                ? AccountStatus.ACTIVE
                : AccountStatus.FROZEN);

        return toResponse(accountRepository.save(account));
    }

    private AccountResponse toResponse(Account account) {
        return AccountResponse.builder()
                .id(account.getId())
                .accountNumber(account.getAccountNumber())
                .type(account.getType())
                .status(account.getStatus())
                .balance(account.getBalance())
                .build();
    }
}

'@ | Out-File -Encoding utf8 'src\main\java\com\bank\banking\service\AccountService.java'
Write-Host '  wrote src\main\java\com\bank\banking\service\AccountService.java'

New-Item -ItemType Directory -Force -Path (Split-Path 'src\main\java\com\bank\banking\controller\AccountController.java') | Out-Null
@'
package com.bank.banking.controller;

import com.bank.banking.dto.AccountLookupResponse;
import com.bank.banking.dto.AccountResponse;
import com.bank.banking.dto.CreateAccountRequest;
import com.bank.banking.service.AccountService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/accounts")
@RequiredArgsConstructor
public class AccountController {

    private final AccountService accountService;

    @GetMapping
    public ResponseEntity<List<AccountResponse>> getMyAccounts(Authentication authentication) {
        return ResponseEntity.ok(accountService.getMyAccounts(authentication));
    }

    @PostMapping
    public ResponseEntity<AccountResponse> openAccount(@Valid @RequestBody CreateAccountRequest request,
                                                         Authentication authentication) {
        return ResponseEntity.ok(accountService.openAccount(request.getType(), authentication));
    }

    @GetMapping("/lookup/{accountNumber}")
    public ResponseEntity<AccountLookupResponse> lookup(@PathVariable String accountNumber) {
        return ResponseEntity.ok(accountService.lookupByAccountNumber(accountNumber));
    }

    @PostMapping("/{accountId}/toggle-freeze")
    public ResponseEntity<AccountResponse> toggleFreeze(@PathVariable Long accountId,
                                                          Authentication authentication) {
        return ResponseEntity.ok(accountService.toggleFreeze(accountId, authentication));
    }
}

'@ | Out-File -Encoding utf8 'src\main\java\com\bank\banking\controller\AccountController.java'
Write-Host '  wrote src\main\java\com\bank\banking\controller\AccountController.java'

Write-Host 'Stripping BOM...' -ForegroundColor Cyan
$filesToFix = @(
    'src\main\java\com\bank\banking\service\AccountService.java',
    'src\main\java\com\bank\banking\controller\AccountController.java'
)
foreach ($f in $filesToFix) {
    $content = Get-Content $f -Raw
    [System.IO.File]::WriteAllText((Resolve-Path $f), $content, (New-Object System.Text.UTF8Encoding($false)))
}

Write-Host 'Done. Now run:  mvn clean package -DskipTests' -ForegroundColor Green