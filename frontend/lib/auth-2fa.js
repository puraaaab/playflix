"use client";

import api from './api.js';

// Setup 2FA - returns QR code and manual entry key
export async function setupTwoFactorAuth() {
  try {
    const response = await api.post('/api/auth/setup-2fa');
    return {
      success: true,
      qrCode: response.data.qrCode,
      manualEntryKey: response.data.manualEntryKey,
      secret: response.data.secret // Needed for verification
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to setup 2FA'
    };
  }
}

// Verify TOTP token to enable 2FA
export async function verifyAndEnable2FA(token, secret) {
  try {
    const response = await api.post('/api/auth/verify-2fa', {
      token,
      secret
    });
    return {
      success: true,
      message: response.data.message
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to verify TOTP'
    };
  }
}

// Verify TOTP during login (after password verification)
export async function verifyTOTPLogin(email, token) {
  try {
    const response = await api.post('/api/auth/verify-totp-login', {
      email,
      token
    });
    return {
      success: true,
      user: response.data.user,
      message: response.data.message
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Invalid TOTP token'
    };
  }
}

// Disable 2FA (requires password)
export async function disableTwoFactorAuth(password) {
  try {
    const response = await api.post('/api/auth/disable-2fa', {
      password
    });
    return {
      success: true,
      message: response.data.message
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to disable 2FA'
    };
  }
}

// Check if session key needs rotation
export async function checkSessionKeyRotation() {
  try {
    const response = await api.post('/api/security/check-key-rotation');
    if (response.data.rotated) {
      // Client should update session key in local storage
      return {
        rotated: true,
        newSessionKey: response.data.newSessionKey
      };
    }
    return { rotated: false };
  } catch (error) {
    console.error('Session key rotation check failed:', error);
    return { rotated: false };
  }
}

// Setup periodic session key rotation check (call this in layout.js)
export function initSessionKeyRotationCheck() {
  // Check for session key rotation every 50 minutes (before 60-min rotation)
  const intervalId = setInterval(() => {
    checkSessionKeyRotation();
  }, 1000 * 60 * 50);

  return () => clearInterval(intervalId);
}
