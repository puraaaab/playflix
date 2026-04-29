function resolveApiBaseUrl() {
  if (typeof window !== 'undefined') {
    return '';
  }

  return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
}

const state = {
  sessionId: null,
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
  return crypto.subtle.importKey(
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

  if (typeof window !== 'undefined' && window.__PLAYFLIX_SECURITY__) {
    state.sessionId = window.__PLAYFLIX_SECURITY__.sessionId;
    state.publicKey = window.__PLAYFLIX_SECURITY__.publicKey;
    state.csrfToken = window.__PLAYFLIX_SECURITY__.csrfToken;
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
        state.publicKey = data.publicKey;
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

export function getSessionId() {
  return state.sessionId;
}

export function clearSecurityContext() {
  state.sessionId = null;
  state.publicKey = null;
  state.csrfToken = null;
}

export async function packData(payload) {
  await bootstrapSecurityContext();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const oneTimeKey = await crypto.subtle.generateKey(
    { name: ALG_PACK, length: 256 },
    true,
    ['encrypt']
  );
  
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const encrypted = await crypto.subtle.encrypt({ name: ALG_PACK, iv }, oneTimeKey, encoded);
  
  const rawKey = await crypto.subtle.exportKey('raw', oneTimeKey);
  const wrapKey = await getWrapKey();
  const wrappedKey = await crypto.subtle.encrypt({ name: ALG_WRAP }, wrapKey, rawKey);

  return {
    encryptedKey: bytesToBase64(new Uint8Array(wrappedKey)),
    payload: bytesToBase64(new Uint8Array(encrypted)),
    iv: bytesToBase64(iv),
    _rawKey: rawKey
  };
}

export async function stampData(rawKey, timestamp, iv, payload) {
  const key = await crypto.subtle.importKey('raw', rawKey, { name: ALG_HMAC, hash: ALG_HASH }, false, ['sign']);
  const message = new TextEncoder().encode(`${timestamp}.${iv}.${payload}`);
  const signature = await crypto.subtle.sign(ALG_HMAC, key, message);
  return bytesToBase64(new Uint8Array(signature));
}
