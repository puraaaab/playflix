import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

const appName = 'PlayFlix';
const windowSize = 2; // Allow ±2 time windows for TOTP (60 seconds tolerance)

export async function generateTOTPSecret(email) {
  const secret = speakeasy.generateSecret({
    name: `${appName} (${email})`,
    issuer: appName,
    length: 32
  });

  const qrCode = await QRCode.toDataURL(secret.otpauth_url);
  return {
    secret: secret.base32,
    qrCode,
    manualEntryKey: secret.base32
  };
}

export function verifyTOTPToken(secret, token) {
  const verified = speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: windowSize
  });

  return verified;
}

export function validateTOTPSetup(secret, token) {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: windowSize
  });
}
