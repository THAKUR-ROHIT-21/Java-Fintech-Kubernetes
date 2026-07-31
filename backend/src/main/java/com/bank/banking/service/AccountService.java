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
     * may hold at most one SAVINGS and one CURRENT account â€” this keeps the
     * dashboard's "Savings Â· Current" summary meaningful without needing to
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
     * deliberately returns only name / type / a masked phone â€” never balance,
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
        if (phone == null || phone.length() < 4) return "â€¢â€¢â€¢â€¢â€¢â€¢";
        return "â€¢â€¢â€¢â€¢â€¢â€¢" + phone.substring(phone.length() - 4);
    }

    /**
     * Freezes or unfreezes one of the current user's own accounts. Deposits
     * and transfers already check AccountStatus.FROZEN and reject with
     * AccountFrozenException, so flipping this one field is enough to
     * actually block money movement â€” no other service needs to change.
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

