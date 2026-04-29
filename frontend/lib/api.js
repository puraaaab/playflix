import axios from 'axios';
import { bootstrapSecurityContext, clearSecurityContext, encryptPayload, getSecurityToken, signPayload } from './security.js';

function resolveApiBaseUrl() {
  if (typeof window !== 'undefined') {
    const configured = process.env.NEXT_PUBLIC_API_BASE_URL || '';
    if (!configured || configured.includes('localhost') || configured.includes('127.0.0.1')) {
      return `${window.location.protocol}//${window.location.hostname}:4000`;
    }
    return configured;
  }

  return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
}

const api = axios.create({
  withCredentials: true,
  timeout: 20000
});

const authlessRoutes = new Set(['/api/security/bootstrap', '/api/security/csrf']);
const refreshExemptRoutes = new Set([
  '/api/security/bootstrap',
  '/api/security/csrf',
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/refresh',
  '/api/auth/logout'
]);

api.interceptors.request.use(async (config) => {
  // Resolve base URL dynamically so it always uses the correct hostname (IP or localhost)
  if (!config.baseURL) {
    config.baseURL = resolveApiBaseUrl();
  }
  await bootstrapSecurityContext();

  const method = (config.method || 'get').toLowerCase();
  const url = config.url || '';
  const shouldEncrypt = method !== 'get' && method !== 'head' && !authlessRoutes.has(url);

  config.headers = config.headers || {};
  config.headers['x-csrf-token'] = getSecurityToken() || '';

  if (shouldEncrypt && config.data && typeof config.data === 'object' && !('payload' in config.data && 'iv' in config.data)) {
    const encrypted = await encryptPayload(config.data);
    const timestamp = String(Date.now());
    const signature = await signPayload(encrypted.payload, encrypted.iv, timestamp);

    config.data = encrypted;
    config.headers['x-playflix-enc'] = 'aes-256-gcm';
    config.headers['x-playflix-timestamp'] = timestamp;
    config.headers['x-playflix-signature'] = signature;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = originalRequest?.url || '';
    if (!originalRequest || error.response?.status !== 401 || originalRequest._retry || refreshExemptRoutes.has(requestUrl)) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    try {
      await api.post('/api/auth/refresh');
      return api(originalRequest);
    } catch (refreshError) {
      clearSecurityContext();
      if (requestUrl.startsWith('/api/payments/')) {
        return Promise.reject(error);
      }
      return Promise.reject(refreshError);
    }
  }
);

export default api;
