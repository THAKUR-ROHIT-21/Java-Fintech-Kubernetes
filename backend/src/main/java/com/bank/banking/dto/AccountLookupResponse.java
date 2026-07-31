package com.bank.banking.dto;

import com.bank.banking.entity.AccountType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Minimal recipient info shown before confirming a transfer â€” enough to
 * verify "am I sending this to the right person", nothing more. Deliberately
 * excludes balance, account status, or the full phone number: any
 * authenticated user can look up any account number (that's the point â€” it's
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

