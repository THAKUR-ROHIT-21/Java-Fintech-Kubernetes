# Ledgerline: adds GET /api/accounts/lookup/{accountNumber} (Send money recipient preview)
# Run this from inside the backend\ folder
Write-Host 'Adding account lookup endpoint...' -ForegroundColor Cyan

New-Item -ItemType Directory -Force -Path (Split-Path 'src\main\java\com\bank\banking\dto\AccountLookupResponse.java') | Out-Null
@'
package com.bank.banking.dto;

import com.bank.banking.entity.AccountType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Minimal recipient info shown before confirming a transfer — enough to
 * verify "am I sending this to the right person", nothing more. Deliberately
 * excludes balance, account status, or the full phone number: any
 * authenticated user can look up any account number (that's the point — it's
 * how you verify a recipient before sending), so this response must never
 * leak anything beyond what's needed for that confirmation.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AccountLookupResponse {
    private String accountNumber;
    private AccountType type;
    private String ownerName;
    private String maskedPhone;
}

'@ | Out-File -Encoding utf8 'src\main\java\com\bank\banking\dto\AccountLookupResponse.java'
Write-Host '  wrote src\main\java\com\bank\banking\dto\AccountLookupResponse.java'

New-Item -ItemType Directory -Force -Path (Split-Path 'src\main\java\com\bank\banking\service\AccountService.java') | Out-Null
@'
package com.bank.banking.service;

import com.bank.banking.dto.AccountLookupResponse;
import com.bank.banking.dto.AccountResponse;
import com.bank.banking.entity.Account;
import com.bank.banking.entity.User;
import com.bank.banking.exception.ResourceNotFoundException;
import com.bank.banking.repository.AccountRepository;
import com.bank.banking.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AccountService {

    private final AccountRepository accountRepository;
    private final UserRepository userRepository;

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
import com.bank.banking.service.AccountService;
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

    @GetMapping("/lookup/{accountNumber}")
    public ResponseEntity<AccountLookupResponse> lookup(@PathVariable String accountNumber) {
        return ResponseEntity.ok(accountService.lookupByAccountNumber(accountNumber));
    }
}

'@ | Out-File -Encoding utf8 'src\main\java\com\bank\banking\controller\AccountController.java'
Write-Host '  wrote src\main\java\com\bank\banking\controller\AccountController.java'

Write-Host 'Stripping BOM...' -ForegroundColor Cyan
$filesToFix = @(
    'src\main\java\com\bank\banking\dto\AccountLookupResponse.java',
    'src\main\java\com\bank\banking\service\AccountService.java',
    'src\main\java\com\bank\banking\controller\AccountController.java'
)
foreach ($f in $filesToFix) {
    $content = Get-Content $f -Raw
    [System.IO.File]::WriteAllText((Resolve-Path $f), $content, (New-Object System.Text.UTF8Encoding($false)))
}

Write-Host 'Done. Now run:  mvn clean package -DskipTests' -ForegroundColor Green