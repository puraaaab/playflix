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

const state = {
  sessionId: null,
  sessionKey: null,
  csrfToken: null,
  readyPromise: null
};

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

async function deriveKeyMaterial(sessionKey) {
  const raw = base64ToBytes(sessionKey);
  const digest = await crypto.subtle.digest('SHA-256', raw);
  return new Uint8Array(digest);
}

async function getAesKey(sessionKey) {
  const raw = await deriveKeyMaterial(sessionKey);
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt']);
}

async function getHmacKey(sessionKey) {
  const raw = await deriveKeyMaterial(sessionKey);
  return crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

export async function bootstrapSecurityContext() {
  if (state.sessionKey) {
    return state;
  }

  if (!state.readyPromise) {
    state.readyPromise = fetch(`${resolveApiBaseUrl()}/api/security/bootstrap`, {
      credentials: 'include'
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Unable to bootstrap PlayFlix security context.');
        }
        const data = await response.json();
        state.sessionId = data.sessionId;
        state.sessionKey = data.sessionKey;
        state.csrfToken = data.csrfToken;
        return state;
      })
      .finally(() => {
        state.readyPromise = null;
      });
  }

  return state.readyPromise;
}

export function getSecurityToken() {
  return state.csrfToken;
}

export function clearSecurityContext() {
  state.sessionId = null;
  state.sessionKey = null;
  state.csrfToken = null;
}

export async function encryptPayload(payload) {
  await bootstrapSecurityContext();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getAesKey(state.sessionKey);
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return {
    payload: bytesToBase64(new Uint8Array(encrypted)),
    iv: bytesToBase64(iv)
  };
}

export async function signPayload(payload, iv, timestamp) {
  await bootstrapSecurityContext();
  const key = await getHmacKey(state.sessionKey);
  const message = new TextEncoder().encode(`${timestamp}.${iv}.${payload}`);
  const signature = await crypto.subtle.sign('HMAC', key, message);
  return bytesToBase64(new Uint8Array(signature));
}
