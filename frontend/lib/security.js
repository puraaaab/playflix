
"use client";

function resolveApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:4000';
}

function getCryptoApi() {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    return window.crypto;
  }

  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
    return globalThis.crypto;
  }

  throw new Error('Web Crypto API not available');
}

const state = {
  sessionId: null,
  sessionKey: null,
  publicKey: null,
  csrfToken: null,
  readyPromise: null
};

const ALG_PACK = ['A', 'E', 'S', '-', 'G', 'C', 'M'].join('');
const ALG_WRAP = ['R', 'S', 'A', '-', 'O', 'A', 'E', 'P'].join('');
const ALG_HASH = ['S', 'H', 'A', '-', '2', '5', '6'].join('');
const ALG_HMAC = ['H', 'M', 'A', 'C'].join('');

function pemToArrayBuffer(pem) {
  const b64 = pem.replace(/(-----(BEGIN|END) PUBLIC KEY-----|\n|\r)/g, '');
  return base64ToBytes(b64).buffer;
}

function bytesToBase64(bytes) {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function getWrapKey() {
  const buf = pemToArrayBuffer(state.publicKey);
  return getCryptoApi().subtle.importKey(
    'spki',
    buf,
    { name: ALG_WRAP, hash: ALG_HASH },
    false,
    ['encrypt']
  );
}

export async function bootstrapSecurityContext() {
  if (state.publicKey) {
    return state;
  }

  if (!state.readyPromise) {
    state.readyPromise = (async () => {
      if (typeof window !== 'undefined') {
        try {
          const response = await fetch(`${resolveApiBaseUrl()}/api/security/bootstrap`, {
            credentials: 'include'
          });
          if (!response.ok) {
            throw new Error(`Bootstrap failed: ${response.status} ${response.statusText}`);
          }
          const data = await response.json();
          state.sessionId = data.sessionId;
          state.sessionKey = data.sessionKey;
          state.publicKey = data.publicKey;
          state.csrfToken = data.csrfToken;
          // Expose a shallow copy of state to window for browser-side access
          // (store a copy to avoid later mutations to the internal `state` object
          // from inadvertently clearing the window-exposed value)
          if (typeof window !== 'undefined') {
            window.__PLAYFLIX_STATE__ = { ...state };
            // mark that the client code created this window copy so we can
            // avoid deleting server-injected bootstrapped values later
            try {
              window.__PLAYFLIX_STATE_CLIENT_SET__ = true;
            } catch (e) {
              // ignore
            }
          }
          return state;
        } catch (error) {
          console.warn('[PlayFlix] Browser bootstrap failed, falling back to injected context if available:', error);
        }
      }

      if (typeof window !== 'undefined' && window.__PLAYFLIX_SECURITY__) {
        state.sessionId = window.__PLAYFLIX_SECURITY__.sessionId;
        state.sessionKey = window.__PLAYFLIX_SECURITY__.sessionKey;
        state.publicKey = window.__PLAYFLIX_SECURITY__.publicKey;
        state.csrfToken = window.__PLAYFLIX_SECURITY__.csrfToken;
        return state;
      }

      throw new Error('Unable to bootstrap PlayFlix security context.');
    })()
      .catch((error) => {
        console.error('[PlayFlix] Security bootstrap failed:', error);
        state.readyPromise = null;
        throw error;
      });
  }

  return state.readyPromise;
}

export function getSecurityToken() {
  const currentState = typeof window !== 'undefined' && window.__PLAYFLIX_STATE__ ? window.__PLAYFLIX_STATE__ : state;
  return currentState.csrfToken;
}

export function getSessionId() {
  const currentState = typeof window !== 'undefined' && window.__PLAYFLIX_STATE__ ? window.__PLAYFLIX_STATE__ : state;
  return currentState.sessionId;
}

export function getSessionKey() {
  const currentState = typeof window !== 'undefined' && window.__PLAYFLIX_STATE__ ? window.__PLAYFLIX_STATE__ : state;
  return currentState.sessionKey;
}

export function hasSecurityPublicKey() {
  const currentState = typeof window !== 'undefined' && window.__PLAYFLIX_STATE__ ? window.__PLAYFLIX_STATE__ : state;
  const hasKey = typeof currentState.publicKey === 'string' && currentState.publicKey.length > 0;
  return hasKey;
}

export function hasSecuritySessionKey() {
  const currentState = typeof window !== 'undefined' && window.__PLAYFLIX_STATE__ ? window.__PLAYFLIX_STATE__ : state;
  return typeof currentState.sessionKey === 'string' && currentState.sessionKey.length > 0;
}

export function clearSecurityContext() {
  state.sessionId = null;
  state.sessionKey = null;
  state.publicKey = null;
  state.csrfToken = null;
  state.readyPromise = null;
  if (typeof window !== 'undefined' && window.__PLAYFLIX_STATE__) {
    // Only remove the window copy if it was created by the client bootstrap
    // (don't clobber server-injected `window.__PLAYFLIX_SECURITY__` or other
    // server-side bootstrap data).
    try {
      if (window.__PLAYFLIX_STATE_CLIENT_SET__) {
        try {
          delete window.__PLAYFLIX_STATE__;
        } catch (e) {
          window.__PLAYFLIX_STATE__ = null;
        }
      }
      // always clear the client-set marker
      delete window.__PLAYFLIX_STATE_CLIENT_SET__;
    } catch (e) {
      // ignore any errors manipulating window properties
    }
  }
}

export async function packData(payload) {
  await bootstrapSecurityContext();
  const cryptoApi = getCryptoApi();
  const iv = cryptoApi.getRandomValues(new Uint8Array(12));
  const oneTimeKey = await cryptoApi.subtle.generateKey(
    { name: ALG_PACK, length: 256 },
    true,
    ['encrypt']
  );
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const encrypted = await cryptoApi.subtle.encrypt({ name: ALG_PACK, iv }, oneTimeKey, encoded);
  const rawKey = await cryptoApi.subtle.exportKey('raw', oneTimeKey);
  const wrapKey = await getWrapKey();
  const wrappedKey = await cryptoApi.subtle.encrypt({ name: ALG_WRAP }, wrapKey, rawKey);
  const packedPayload = {
    iv: bytesToBase64(iv),
    payload: bytesToBase64(new Uint8Array(encrypted))
  };

  return {
    envelope: [
      bytesToBase64(new Uint8Array(wrappedKey)),
      bytesToBase64(new TextEncoder().encode(JSON.stringify(packedPayload)))
    ],
    _rawKey: rawKey
  };
}

export async function unsealData(envelope) {
  await bootstrapSecurityContext();
  const cryptoApi = getCryptoApi();
  if (!state.sessionKey) {
    throw new Error('Security session key not available.');
  }

  const rawKey = base64ToBytes(state.sessionKey);
  const key = await cryptoApi.subtle.importKey('raw', rawKey, { name: ALG_PACK, length: 256 }, false, ['decrypt']);
  let payloadValue = envelope.payload;
  let ivValue = envelope.iv;

  if (typeof payloadValue === 'string' && !ivValue) {
    try {
      const packedEnvelope = JSON.parse(new TextDecoder().decode(base64ToBytes(payloadValue)));
      if (packedEnvelope && typeof packedEnvelope === 'object') {
        payloadValue = packedEnvelope.payload;
        ivValue = packedEnvelope.iv;
      }
    } catch {
      // Fall through to legacy handling below.
    }
  }

  const payloadBuffer = base64ToBytes(payloadValue);
  const ivBuffer = base64ToBytes(ivValue);
  const decrypted = await cryptoApi.subtle.decrypt({ name: ALG_PACK, iv: ivBuffer }, key, payloadBuffer);
  return JSON.parse(new TextDecoder().decode(decrypted));
}

export async function stampData(rawKey, timestamp, iv, payload) {
  await bootstrapSecurityContext();
  const cryptoApi = getCryptoApi();
  const key = await cryptoApi.subtle.importKey('raw', rawKey, { name: ALG_HMAC, hash: ALG_HASH }, false, ['sign']);
  const message = new TextEncoder().encode(`${timestamp}.${iv}.${payload}`);
  const signature = await cryptoApi.subtle.sign(ALG_HMAC, key, message);
  return bytesToBase64(new Uint8Array(signature));
}
