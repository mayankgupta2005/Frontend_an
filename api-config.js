// api-config.js
// Centralized configuration for REST API and WebSocket connections

const API_BASE_URL = (import.meta.env.VITE_API_URL || "https://novashields-backend.onrender.com").replace(/\/+$/, '');

export const API_URL = `${API_BASE_URL}/api`;

// Derive WebSocket URL from HTTP URL (https → wss, http → ws)
const wsProtocol = API_BASE_URL.startsWith('https') ? 'wss' : 'ws';
const wsDomain = API_BASE_URL.replace(/^https?:\/\//, '');
export const WS_BASE_URL = `${wsProtocol}://${wsDomain}`;

export function getAuthHeaders() {
  const token = localStorage.getItem('ns_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

export function saveAuthData(data) {
  localStorage.setItem('ns_token', data.access_token);
  localStorage.setItem('ns_user_id', data.user_id);
  localStorage.setItem('ns_user_name', data.name);
}

export function clearAuthData() {
  localStorage.removeItem('ns_token');
  localStorage.removeItem('ns_user_id');
  localStorage.removeItem('ns_user_name');
}

export function getUserId() {
  return localStorage.getItem('ns_user_id');
}

/**
 * Check if the current token is valid.
 * If a 401 is returned from the backend, clear auth data and redirect to login.
 */
export function handleUnauthorized(response) {
  if (response.status === 401) {
    clearAuthData();
    window.location.href = 'login.html';
    return true;
  }
  return false;
}
