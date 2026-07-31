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
 * Admin-only view of one account, including the owning customer's identity â€”
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

