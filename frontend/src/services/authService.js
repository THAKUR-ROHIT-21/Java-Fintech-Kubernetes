import request from './api';

export async function login(email, password) {
  const data = await request('/auth/login', {
    method: 'POST',
    body: { email, password },
    auth: false,
  });

  localStorage.setItem('ledgerline_token', data.token);
  localStorage.setItem('ledgerline_user', JSON.stringify({
    userId: data.userId,
    fullName: data.fullName,
    email: data.email,
    role: data.role,
  }));

  return data;
}

export async function register({ fullName, email, phone, password }) {
  const data = await request('/auth/register', {
    method: 'POST',
    body: { fullName, email, phone, password },
    auth: false,
  });

  localStorage.setItem('ledgerline_token', data.token);
  localStorage.setItem('ledgerline_user', JSON.stringify({
    userId: data.userId,
    fullName: data.fullName,
    email: data.email,
    role: data.role,
  }));

  return data;
}

export function logout() {
  localStorage.removeItem('ledgerline_token');
  localStorage.removeItem('ledgerline_user');
}

export function getCurrentUser() {
  const raw = localStorage.getItem('ledgerline_user');
  return raw ? JSON.parse(raw) : null;
}

export function isAuthenticated() {
  return !!localStorage.getItem('ledgerline_token');
}