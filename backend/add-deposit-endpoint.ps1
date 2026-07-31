# Ledgerline: adds POST /api/accounts/{id}/deposit (Add money feature)
# Run this from inside the backend\ folder
Write-Host 'Adding deposit endpoint...' -ForegroundColor Cyan

New-Item -ItemType Directory -Force -Path (Split-Path 'src\main\java\com\bank\banking\dto\DepositRequest.java') | Out-Null
@'
package com.bank.banking.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class DepositRequest {

    @NotNull(message = "Amount is required")
    @DecimalMin(value = "0.01", message = "Amount must be greater than zero")
    private BigDecimal amount;

    private String description;

    // client-generated key so a retried request never double-applies the same deposit
    @NotBlank(message = "Idempotency key is required")
    private String idempotencyKey;
}

'@ | Out-File -Encoding utf8 'src\main\java\com\bank\banking\dto\DepositRequest.java'
Write-Host '  wrote src\main\java\com\bank\banking\dto\DepositRequest.java'

New-Item -ItemType Directory -Force -Path (Split-Path 'src\main\java\com\bank\banking\service\TransactionService.java') | Out-Null
@'
package com.bank.banking.service;

import com.bank.banking.dto.DepositRequest;
import com.bank.banking.dto.TransactionResponse;
import com.bank.banking.dto.TransferRequest;
import com.bank.banking.entity.*;
import com.bank.banking.exception.AccountFrozenException;
import com.bank.banking.exception.InsufficientFundsException;
import com.bank.banking.exception.ResourceNotFoundException;
import com.bank.banking.repository.AccountRepository;
import com.bank.banking.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TransactionService {

    private final AccountRepository accountRepository;
    private final TransactionRepository transactionRepository;
    private final AccountService accountService;

    private static final SecureRandom RANDOM = new SecureRandom();

    /**
     * Money transfer between two accounts.
     *
     * Correctness guarantees:
     *  - Idempotency: a repeated request with the same idempotencyKey returns the original
     *    result instead of moving money twice (protects against client retries / double-clicks).
     *  - Row-level locking: both accounts are locked with SELECT ... FOR UPDATE for the
     *    duration of this transaction, always in ascending account-id order, so two transfers
     *    that touch the same pair of accounts from opposite directions can never deadlock.
     *  - BigDecimal everywhere: no floating point ever touches a balance.
     *  - The whole method is one @Transactional unit — either both balances update and both
     *    ledger rows are written, or none of it is (a mid-way failure rolls back completely).
     */
    @Transactional
    public TransactionResponse transfer(TransferRequest request, Authentication authentication) {
        User currentUser = accountService.currentUser(authentication);

        // idempotency check — if this exact request already ran, hand back the original result
        var existing = transactionRepository.findByIdempotencyKey(request.getIdempotencyKey());
        if (existing.isPresent()) {
            return toResponse(existing.get());
        }

        Account fromLookup = accountRepository.findByAccountNumber(request.getFromAccountNumber())
                .orElseThrow(() -> new ResourceNotFoundException("Source account not found"));
        Account toLookup = accountRepository.findByAccountNumber(request.getToAccountNumber())
                .orElseThrow(() -> new ResourceNotFoundException("Destination account not found"));

        if (!fromLookup.getOwner().getId().equals(currentUser.getId())) {
            throw new ResourceNotFoundException("Source account not found");
        }
        if (fromLookup.getId().equals(toLookup.getId())) {
            throw new IllegalArgumentException("Cannot transfer to the same account");
        }

        // always lock in ascending id order to prevent deadlocks between two concurrent,
        // opposite-direction transfers on the same pair of accounts
        Long firstId = Math.min(fromLookup.getId(), toLookup.getId());
        Long secondId = Math.max(fromLookup.getId(), toLookup.getId());
        accountRepository.findByIdForUpdate(firstId);
        accountRepository.findByIdForUpdate(secondId);

        Account from = accountRepository.findByIdForUpdate(fromLookup.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Source account not found"));
        Account to = accountRepository.findByIdForUpdate(toLookup.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Destination account not found"));

        if (from.getStatus() == AccountStatus.FROZEN) {
            throw new AccountFrozenException("Source account is frozen");
        }
        if (to.getStatus() == AccountStatus.FROZEN) {
            throw new AccountFrozenException("Destination account is frozen");
        }

        BigDecimal amount = request.getAmount();
        if (from.getBalance().compareTo(amount) < 0) {
            throw new InsufficientFundsException("Insufficient balance for this transfer");
        }

        from.setBalance(from.getBalance().subtract(amount));
        to.setBalance(to.getBalance().add(amount));

        String reference = generateReference();

        Transaction debit = Transaction.builder()
                .reference(reference + "-D")
                .account(from)
                .relatedAccount(to)
                .type(TransactionType.TRANSFER_OUT)
                .status(TransactionStatus.COMPLETED)
                .amount(amount)
                .balanceAfter(from.getBalance())
                .description(request.getDescription())
                .idempotencyKey(request.getIdempotencyKey())
                .build();

        Transaction credit = Transaction.builder()
                .reference(reference + "-C")
                .account(to)
                .relatedAccount(from)
                .type(TransactionType.TRANSFER_IN)
                .status(TransactionStatus.COMPLETED)
                .amount(amount)
                .balanceAfter(to.getBalance())
                .description(request.getDescription())
                .build();

        accountRepository.save(from);
        accountRepository.save(to);
        transactionRepository.save(credit);
        Transaction savedDebit = transactionRepository.save(debit);

        return toResponse(savedDebit);
    }

    /**
     * Deposit money into one of the current user's own accounts — simulates
     * "add money from a linked bank" in the UI. Same correctness guarantees
     * as transfer(): idempotent, row-locked, BigDecimal, one transactional unit.
     */
    @Transactional
    public TransactionResponse deposit(Long accountId, DepositRequest request, Authentication authentication) {
        User currentUser = accountService.currentUser(authentication);

        var existing = transactionRepository.findByIdempotencyKey(request.getIdempotencyKey());
        if (existing.isPresent()) {
            return toResponse(existing.get());
        }

        Account account = accountRepository.findByIdForUpdate(accountId)
                .orElseThrow(() -> new ResourceNotFoundException("Account not found"));

        if (!account.getOwner().getId().equals(currentUser.getId())) {
            throw new ResourceNotFoundException("Account not found");
        }
        if (account.getStatus() == AccountStatus.FROZEN) {
            throw new AccountFrozenException("This account is frozen");
        }

        BigDecimal amount = request.getAmount();
        account.setBalance(account.getBalance().add(amount));

        Transaction tx = Transaction.builder()
                .reference(generateReference())
                .account(account)
                .type(TransactionType.DEPOSIT)
                .status(TransactionStatus.COMPLETED)
                .amount(amount)
                .balanceAfter(account.getBalance())
                .description(request.getDescription() != null && !request.getDescription().isBlank()
                        ? request.getDescription() : "Added money")
                .idempotencyKey(request.getIdempotencyKey())
                .build();

        accountRepository.save(account);
        Transaction saved = transactionRepository.save(tx);

        return toResponse(saved);
    }

    public List<TransactionResponse> getHistory(Long accountId, Authentication authentication, Pageable pageable) {
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new ResourceNotFoundException("Account not found"));

        User currentUser = accountService.currentUser(authentication);
        if (!account.getOwner().getId().equals(currentUser.getId())) {
            throw new ResourceNotFoundException("Account not found");
        }

        Page<Transaction> page = transactionRepository.findByAccountIdOrderByCreatedAtDesc(accountId, pageable);
        return page.getContent().stream().map(this::toResponse).collect(Collectors.toList());
    }

    private String generateReference() {
        StringBuilder sb = new StringBuilder("TXN-");
        for (int i = 0; i < 8; i++) {
            sb.append(RANDOM.nextInt(10));
        }
        return sb.toString();
    }

    private TransactionResponse toResponse(Transaction tx) {
        return TransactionResponse.builder()
                .reference(tx.getReference())
                .type(tx.getType())
                .status(tx.getStatus())
                .amount(tx.getAmount())
                .balanceAfter(tx.getBalanceAfter())
                .description(tx.getDescription())
                .createdAt(tx.getCreatedAt())
                .build();
    }
}

'@ | Out-File -Encoding utf8 'src\main\java\com\bank\banking\service\TransactionService.java'
Write-Host '  wrote src\main\java\com\bank\banking\service\TransactionService.java'

New-Item -ItemType Directory -Force -Path (Split-Path 'src\main\java\com\bank\banking\controller\TransactionController.java') | Out-Null
@'
package com.bank.banking.controller;

import com.bank.banking.dto.DepositRequest;
import com.bank.banking.dto.TransactionResponse;
import com.bank.banking.dto.TransferRequest;
import com.bank.banking.service.TransactionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class TransactionController {

    private final TransactionService transactionService;

    @PostMapping("/transfers")
    public ResponseEntity<TransactionResponse> transfer(@Valid @RequestBody TransferRequest request,
                                                          Authentication authentication) {
        return ResponseEntity.ok(transactionService.transfer(request, authentication));
    }

    @PostMapping("/accounts/{accountId}/deposit")
    public ResponseEntity<TransactionResponse> deposit(@PathVariable Long accountId,
                                                         @Valid @RequestBody DepositRequest request,
                                                         Authentication authentication) {
        return ResponseEntity.ok(transactionService.deposit(accountId, request, authentication));
    }

    @GetMapping("/accounts/{accountId}/transactions")
    public ResponseEntity<List<TransactionResponse>> history(@PathVariable Long accountId,
                                                               @RequestParam(defaultValue = "0") int page,
                                                               @RequestParam(defaultValue = "20") int size,
                                                               Authentication authentication) {
        return ResponseEntity.ok(
                transactionService.getHistory(accountId, authentication, PageRequest.of(page, size))
        );
    }
}

'@ | Out-File -Encoding utf8 'src\main\java\com\bank\banking\controller\TransactionController.java'
Write-Host '  wrote src\main\java\com\bank\banking\controller\TransactionController.java'

Write-Host 'Stripping BOM...' -ForegroundColor Cyan
$filesToFix = @(
    'src\main\java\com\bank\banking\dto\DepositRequest.java',
    'src\main\java\com\bank\banking\service\TransactionService.java',
    'src\main\java\com\bank\banking\controller\TransactionController.java'
)
foreach ($f in $filesToFix) {
    $content = Get-Content $f -Raw
    [System.IO.File]::WriteAllText((Resolve-Path $f), $content, (New-Object System.Text.UTF8Encoding($false)))
}

Write-Host 'Done. Now run:  mvn clean package -DskipTests' -ForegroundColor Green