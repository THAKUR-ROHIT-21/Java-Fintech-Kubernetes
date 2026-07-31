import request from './api';

export function getMyAccounts() {
  return request('/accounts');
}

export function getTransactions(accountId, page = 0, size = 20) {
  return request(`/accounts/${accountId}/transactions?page=${page}&size=${size}`);
}

export function lookupAccount(accountNumber) {
  return request(`/accounts/lookup/${accountNumber}`);
}

export function createAccount(type) {
  return request('/accounts', {
    method: 'POST',
    body: { type },
  });
}

export function toggleFreeze(accountId) {
  return request(`/accounts/${accountId}/toggle-freeze`, {
    method: 'POST',
  });
}

export function depositMoney(accountId, { amount, description, idempotencyKey }) {
  return request(`/accounts/${accountId}/deposit`, {
    method: 'POST',
    body: { amount, description, idempotencyKey },
  });
}

export function transfer({ fromAccountNumber, toAccountNumber, amount, description, idempotencyKey }) {
  return request('/transfers', {
    method: 'POST',
    body: { fromAccountNumber, toAccountNumber, amount, description, idempotencyKey },
  });
}