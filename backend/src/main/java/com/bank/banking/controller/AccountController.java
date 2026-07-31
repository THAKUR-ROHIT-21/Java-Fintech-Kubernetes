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

