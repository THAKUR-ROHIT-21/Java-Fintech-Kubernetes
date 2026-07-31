package com.bank.banking.dto;

import com.bank.banking.entity.AccountStatus;
import com.bank.banking.entity.AccountType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AccountResponse {
    private Long id;
    private String accountNumber;
    private AccountType type;
    private AccountStatus status;
    private BigDecimal balance;
}
