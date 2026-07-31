# Ledgerline: adds missing CreateAccountRequest DTO
Write-Host 'Adding CreateAccountRequest DTO...' -ForegroundColor Cyan

New-Item -ItemType Directory -Force -Path (Split-Path 'src\main\java\com\bank\banking\dto\CreateAccountRequest.java') | Out-Null
@'
package com.bank.banking.dto;

import com.bank.banking.entity.AccountType;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateAccountRequest {

    @NotNull(message = "Account type is required")
    private AccountType type;
}

'@ | Out-File -Encoding utf8 'src\main\java\com\bank\banking\dto\CreateAccountRequest.java'
Write-Host '  wrote src\main\java\com\bank\banking\dto\CreateAccountRequest.java'

Write-Host 'Stripping BOM...' -ForegroundColor Cyan
$filesToFix = @(
    'src\main\java\com\bank\banking\dto\CreateAccountRequest.java'
)
foreach ($f in $filesToFix) {
    $content = Get-Content $f -Raw
    [System.IO.File]::WriteAllText((Resolve-Path $f), $content, (New-Object System.Text.UTF8Encoding($false)))
}

Write-Host 'Done. Now run:  mvn clean package -DskipTests' -ForegroundColor Green