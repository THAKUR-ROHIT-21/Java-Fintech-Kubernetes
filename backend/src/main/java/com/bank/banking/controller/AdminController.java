package com.bank.banking.controller;

import com.bank.banking.dto.CustomerAccountResponse;
import com.bank.banking.service.AdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;

    // Route-level restriction lives in SecurityConfig (/api/admin/** -> hasRole("ADMIN")),
    // this endpoint itself stays simple.
    @GetMapping("/accounts")
    public ResponseEntity<List<CustomerAccountResponse>> getAllAccounts() {
        return ResponseEntity.ok(adminService.getAllAccounts());
    }
}

