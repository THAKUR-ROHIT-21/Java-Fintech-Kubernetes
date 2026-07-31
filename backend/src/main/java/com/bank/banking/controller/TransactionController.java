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

