/**
 * Crypto utilities for client-side encryption using Web Crypto API.
 * Fixed version - salt problem solved + TypeScript type corrections
 */

export async function generateKeyPair() {
  return await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function exportPublicKey(key: CryptoKey) {
  const exported = await window.crypto.subtle.exportKey("spki", key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

export async function importPublicKey(spkiBase64: string) {
  const binaryDerString = atob(spkiBase64);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }
  return await window.crypto.subtle.importKey(
    "spki",
    binaryDer,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["encrypt"]
  );
}

export async function exportPrivateKey(key: CryptoKey) {
  const exported = await window.crypto.subtle.exportKey("pkcs8", key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

export async function importPrivateKey(pkcs8Base64: string) {
  const binaryDerString = atob(pkcs8Base64);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }
  return await window.crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["decrypt"]
  );
}

// Password-based key derivation for protecting the private key
// FIXED: salt type changed from Uint8Array to BufferSource
export async function deriveKeyFromPassword(
  password: string,
  salt?: BufferSource
): Promise<{ key: CryptoKey; salt: BufferSource }> {
  const finalSalt: BufferSource = salt || window.crypto.getRandomValues(new Uint8Array(16));

  const encoder = new TextEncoder();
  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  const derivedKey = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: finalSalt,
      iterations: 100000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  return { key: derivedKey, salt: finalSalt };
}

// FIXED: Now handles salt internally
export async function encryptPrivateKey(
  privateKeyBase64: string,
  password: string
): Promise<{ ciphertext: string; iv: string; salt: string }> {
  const { key: passwordKey, salt } = await deriveKeyFromPassword(password);

  const encoder = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    passwordKey,
    encoder.encode(privateKeyBase64)
  );

  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv)),
    salt: btoa(String.fromCharCode(...(salt as Uint8Array))),
  };
}

// FIXED: Now accepts complete object with salt
export async function decryptPrivateKey(
  encryptedData: { ciphertext: string; iv: string; salt: string },
  password: string
): Promise<string> {
  const salt = new Uint8Array(atob(encryptedData.salt).split("").map(c => c.charCodeAt(0)));
  const { key: passwordKey } = await deriveKeyFromPassword(password, salt);

  const ciphertext = new Uint8Array(atob(encryptedData.ciphertext).split("").map(c => c.charCodeAt(0)));
  const iv = new Uint8Array(atob(encryptedData.iv).split("").map(c => c.charCodeAt(0)));

  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    passwordKey,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

// File encryption
export async function generateFileKey() {
  return await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function encryptFile(fileData: ArrayBuffer, aesKey: CryptoKey) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    fileData
  );
  return {
    ciphertext: encrypted,
    iv: btoa(String.fromCharCode(...iv)),
  };
}

export async function decryptFile(
  encryptedData: ArrayBuffer,
  ivBase64: string,
  aesKey: CryptoKey
): Promise<ArrayBuffer> {
  const iv = new Uint8Array(atob(ivBase64).split("").map(c => c.charCodeAt(0)));
  return await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    aesKey,
    encryptedData
  );
}

export async function wrapFileKey(aesKey: CryptoKey, publicKey: CryptoKey): Promise<string> {
  const rawKey = await window.crypto.subtle.exportKey("raw", aesKey);
  const wrapped = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    rawKey
  );
  return btoa(String.fromCharCode(...new Uint8Array(wrapped)));
}

export async function unwrapFileKey(wrappedKeyBase64: string, privateKey: CryptoKey): Promise<CryptoKey> {
  const wrappedKey = new Uint8Array(atob(wrappedKeyBase64).split("").map(c => c.charCodeAt(0)));
  const rawKey = await window.crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    wrappedKey
  );
  return await window.crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM", length: 256 } as AesKeyGenParams,
    true,
    ["decrypt"]
  );
}