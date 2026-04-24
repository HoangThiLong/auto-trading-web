import CryptoJS from 'crypto-js';
import { readRuntimeEnv } from './runtimeEnv';

/**
 * AES-256-CBC Credential Encryption for non-Electron mode.
 *
 * Encryption hierarchy:
 *   1. Electron mode → uses OS-level safeStorage (handled in useStore.ts)
 *   2. Web/Dev mode  → uses AES encryption with passphrase from env var
 *
 * Passphrase priority:
 *   import.meta.env.VITE_APP_ENCRYPTION_KEY  (Vite/Electron renderer)
 *   > process.env.ENCRYPTION_KEY             (Node.js CLI / bot.ts)
 *
 * NOTE: No hardcoded fallback - encryption requires explicit environment variable
 */

function resolvePassphrase(): string {
  const envKey =
    readRuntimeEnv('VITE_APP_ENCRYPTION_KEY') ||
    readRuntimeEnv('ENCRYPTION_KEY');

  if (!envKey) {
    throw new Error('ENCRYPTION_KEY environment variable is required for credential encryption');
  }

  return envKey;
}

/**
 * Encrypt a JSON-serializable object using AES-256.
 * Returns a Base64-encoded ciphertext string.
 */
export function encryptCredentials(data: unknown): string {
  const passphrase = resolvePassphrase();
  const jsonStr = JSON.stringify(data);
  return CryptoJS.AES.encrypt(jsonStr, passphrase).toString();
}

/**
 * Decrypt a Base64-encoded AES ciphertext back to an object.
 * Returns null if decryption fails (e.g. passphrase changed, corrupt data).
 */
export function decryptCredentials<T = unknown>(ciphertext: string): T | null {
  try {
    const passphrase = resolvePassphrase();
    const bytes = CryptoJS.AES.decrypt(ciphertext, passphrase);
    const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);

    if (!decryptedStr) {
      console.warn('[credentialCrypto] Decryption produced empty string (wrong passphrase?)');
      return null;
    }

    return JSON.parse(decryptedStr) as T;
  } catch (err) {
    console.warn('[credentialCrypto] Decryption failed:', err);
    return null;
  }
}

/**
 * Check if the current environment is Electron with safeStorage available.
 * When true, AES encryption is unnecessary (OS-level encryption is used instead).
 */
export function isElectronSecureMode(): boolean {
  return typeof window !== 'undefined' && !!(window as any).electronAPI;
}
