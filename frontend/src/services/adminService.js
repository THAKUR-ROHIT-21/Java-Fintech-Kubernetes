import request from './api';

export function getAllAccounts() {
  return request('/admin/accounts');
}