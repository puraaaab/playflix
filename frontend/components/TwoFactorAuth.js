"use client";

import { useState, useEffect } from 'react';
import { setupTwoFactorAuth, verifyAndEnable2FA, disableTwoFactorAuth } from '@/lib/auth-2fa';

/**
 * TwoFactorAuthForm Component
 * Handles TOTP 2FA setup, verification, and disabling
 * 
 * Usage:
 * <TwoFactorAuthForm onSuccess={handleSuccess} userEmail="user@example.com" />
 */
export function TwoFactorAuthForm({ onSuccess, userEmail, isEnabled = false }) {
  const [step, setStep] = useState('idle'); // idle, setup, verify, disable
  const [qrCode, setQrCode] = useState(null);
  const [manualKey, setManualKey] = useState(null);
  const [secret, setSecret] = useState(null);
  const [totp, setTotp] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Step 1: Initiate 2FA setup
  const handleSetupClick = async () => {
    setLoading(true);
    setError(null);
    
    const result = await setupTwoFactorAuth();
    if (result.success) {
      setQrCode(result.qrCode);
      setManualKey(result.manualEntryKey);
      setSecret(result.secret);
      setStep('verify');
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  // Step 2: Verify TOTP and enable 2FA
  const handleVerifyClick = async (e) => {
    e.preventDefault();
    if (!totp || totp.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    setError(null);
    
    const result = await verifyAndEnable2FA(totp, secret);
    if (result.success) {
      setSuccess(result.message);
      setTotp('');
      setQrCode(null);
      setSecret(null);
      setTimeout(() => {
        setStep('idle');
        onSuccess?.('2FA enabled successfully');
      }, 1500);
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  // Step 3: Disable 2FA
  const handleDisableClick = async (e) => {
    e.preventDefault();
    if (!password) {
      setError('Please enter your password to disable 2FA');
      return;
    }

    setLoading(true);
    setError(null);
    
    const result = await disableTwoFactorAuth(password);
    if (result.success) {
      setSuccess(result.message);
      setPassword('');
      setTimeout(() => {
        setStep('idle');
        onSuccess?.('2FA disabled successfully');
      }, 1500);
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  // Reset form
  const handleCancel = () => {
    setStep('idle');
    setTotp('');
    setPassword('');
    setQrCode(null);
    setSecret(null);
    setError(null);
    setSuccess(null);
  };

  if (step === 'idle') {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Two-Factor Authentication</h3>
        {isEnabled ? (
          <div className="space-y-3">
            <p className="text-green-600 font-semibold">✓ 2FA is enabled</p>
            <button
              onClick={() => setStep('disable')}
              className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Disable 2FA
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-gray-600">
              Enhance your account security with two-factor authentication using an authenticator app.
            </p>
            <button
              onClick={handleSetupClick}
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Setting up...' : 'Enable 2FA'}
            </button>
          </div>
        )}
      </div>
    );
  }

  if (step === 'verify') {
    return (
      <div className="space-y-4 border border-gray-300 rounded-lg p-6">
        <h3 className="text-lg font-semibold">Set Up Two-Factor Authentication</h3>
        
        {qrCode && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Scan this QR code with your authenticator app (Google Authenticator, Authy, Microsoft Authenticator, etc.)
            </p>
            <div className="flex justify-center">
              <img src={qrCode} alt="TOTP QR Code" className="w-64 h-64 border-2 border-gray-300 rounded-lg" />
            </div>
            
            <div className="space-y-2">
              <p className="text-sm font-semibold">Can't scan the QR code?</p>
              <p className="text-sm text-gray-600">Enter this key manually:</p>
              <div className="bg-gray-100 p-3 rounded-lg font-mono text-sm break-all">
                {manualKey}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleVerifyClick} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Enter 6-digit code from your authenticator app
            </label>
            <input
              type="text"
              maxLength="6"
              placeholder="000000"
              value={totp}
              onChange={(e) => setTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-2xl text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
              autoFocus
            />
          </div>

          {error && <div className="text-red-600 text-sm">{error}</div>}
          {success && <div className="text-green-600 text-sm">{success}</div>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || totp.length !== 6}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify & Enable'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (step === 'disable') {
    return (
      <div className="space-y-4 border border-red-300 rounded-lg p-6 bg-red-50">
        <h3 className="text-lg font-semibold text-red-700">Disable Two-Factor Authentication</h3>
        
        <p className="text-sm text-gray-700">
          Disabling 2FA will make your account less secure. Enter your password to continue.
        </p>

        <form onSubmit={handleDisableClick} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Confirm your password
            </label>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              disabled={loading}
              autoFocus
            />
          </div>

          {error && <div className="text-red-600 text-sm">{error}</div>}
          {success && <div className="text-green-600 text-sm">{success}</div>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !password}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? 'Disabling...' : 'Disable 2FA'}
            </button>
          </div>
        </form>
      </div>
    );
  }
}

/**
 * LoginTOTPForm Component
 * Handles TOTP verification during login
 * 
 * Usage:
 * <LoginTOTPForm email="user@example.com" onSuccess={handleLoginSuccess} />
 */
export function LoginTOTPForm({ email, onSuccess, onBack }) {
  const [totp, setTotp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { verifyTOTPLogin } = require('@/lib/auth-2fa');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!totp || totp.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    setError(null);

    const result = await verifyTOTPLogin(email, totp);
    if (result.success) {
      onSuccess?.(result.user);
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Enter Authentication Code</h2>
      <p className="text-gray-600">
        Enter the 6-digit code from your authenticator app
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          maxLength="6"
          placeholder="000000"
          value={totp}
          onChange={(e) => setTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-3xl text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
          autoFocus
        />

        {error && <div className="text-red-600 text-sm">{error}</div>}

        <button
          type="submit"
          disabled={loading || totp.length !== 6}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold"
        >
          {loading ? 'Verifying...' : 'Verify'}
        </button>

        <button
          type="button"
          onClick={onBack}
          className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          Back
        </button>
      </form>
    </div>
  );
}
