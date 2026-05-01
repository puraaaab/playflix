
"use client";

import axios from 'axios';
import { bootstrapSecurityContext, clearSecurityContext, hasSecurityPublicKey, packData, getSecurityToken, getSessionId, stampData, unsealData } from './security.js';

function resolveApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || 'https://localhost:4000';
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

function canUseSecurePayload() {
  return typeof window !== 'undefined' && window.isSecureContext && typeof window.crypto?.subtle !== 'undefined';
}

async function maybeUnsealResponse(response) {
  if (response?.headers?.['x-playflix-sealed'] === 'true') {
    response.data = await unsealData(response.data);
  }
  return response;
}

api.interceptors.request.use(async (config) => {
  if (!config.baseURL) {
    config.baseURL = resolveApiBaseUrl();
  }

  await bootstrapSecurityContext();

  const method = (config.method || 'get').toLowerCase();
  const url = config.url || '';
  const shouldEncrypt = method !== 'get' && method !== 'head' && !authlessRoutes.has(url);

  config.headers = config.headers || {};
  config.headers['x-csrf-token'] = getSecurityToken() || '';

  const sessionId = getSessionId();
  if (sessionId) {
    config.headers['x-playflix-session'] = sessionId;
  }

  const useSecurePayload = shouldEncrypt && canUseSecurePayload() && hasSecurityPublicKey();
  if (shouldEncrypt && !useSecurePayload) {
    throw new Error(`Encrypted request required for ${config.url}, but the secure browser bootstrap is unavailable.`);
  }

  if (useSecurePayload && config.data && typeof config.data === 'object' && !Array.isArray(config.data)) {
    const packed = await packData(config.data);
    const timestamp = String(Date.now());
    const signature = await stampData(packed._rawKey, timestamp, packed.envelope[0], packed.envelope[1]);

    config.data = packed.envelope;
    config.headers['x-playflix-mode'] = 'secure';
    config.headers['x-playflix-timestamp'] = timestamp;
    config.headers['x-playflix-signature'] = signature;
  }

  return config;
});

api.interceptors.response.use(
  async (response) => maybeUnsealResponse(response),
  async (error) => {
    if (error.response?.headers?.['x-playflix-sealed'] === 'true') {
      try {
        error.response.data = await unsealData(error.response.data);
      } catch {
        // Leave encrypted error payload as-is if decryption fails.
      }
    }

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
      if (refreshError.response?.headers?.['x-playflix-sealed'] === 'true') {
        try {
          refreshError.response.data = await unsealData(refreshError.response.data);
        } catch {
          // ignore
        }
      }
      clearSecurityContext();
      if (requestUrl.startsWith('/api/payments/')) {
        return Promise.reject(error);
      }
      return Promise.reject(refreshError);
    }
  }
);

export default api;
