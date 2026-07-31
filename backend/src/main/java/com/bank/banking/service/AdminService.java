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
     * Only reachable by ROLE_ADMIN â€” enforced in SecurityConfig, not here,
     * so this stays a plain data-access method with no auth logic mixed in.
     *
     * @Transactional(readOnly = true) keeps the Hibernate session open long
     * enough to read the lazily-loaded Account.owner association below â€”
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

