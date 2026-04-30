import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const AUTH_ENCRYPTION_KEY_BYTES = 32;
const AES_GCM_IV_BYTES = 12;
const AES_GCM_AUTH_TAG_BYTES = 16;
const ENCRYPTED_VALUE_VERSION = 'v1';

function decodeBase64Url(value: string): Buffer | null {
  try {
    return Buffer.from(value, 'base64url');
  } catch {
    return null;
  }
}

function decodeBase64(value: string): Buffer | null {
  try {
    return Buffer.from(value, 'base64');
  } catch {
    return null;
  }
}

function normalizeAuthEncryptionKey(value: string | undefined): Buffer {
  const trimmed = value?.trim();

  if (!trimmed) {
    throw new Error('AUTH_ENCRYPTION_KEY must be configured');
  }

  const base64UrlKey = decodeBase64Url(trimmed);

  if (base64UrlKey?.length === AUTH_ENCRYPTION_KEY_BYTES) {
    return base64UrlKey;
  }

  const base64Key = decodeBase64(trimmed);

  if (base64Key?.length === AUTH_ENCRYPTION_KEY_BYTES) {
    return base64Key;
  }

  const utf8Key = Buffer.from(trimmed, 'utf8');

  if (utf8Key.length === AUTH_ENCRYPTION_KEY_BYTES) {
    return utf8Key;
  }

  throw new Error('AUTH_ENCRYPTION_KEY must resolve to exactly 32 bytes');
}

@Injectable()
export class CryptoService {
  private readonly key = normalizeAuthEncryptionKey(process.env.AUTH_ENCRYPTION_KEY);

  encrypt(plaintext: string): string {
    const iv = randomBytes(AES_GCM_IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv, {
      authTagLength: AES_GCM_AUTH_TAG_BYTES,
    });
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return [
      ENCRYPTED_VALUE_VERSION,
      iv.toString('base64url'),
      authTag.toString('base64url'),
      ciphertext.toString('base64url'),
    ].join(':');
  }

  decrypt(encryptedValue: string): string {
    const parts = encryptedValue.split(':');

    if (parts.length !== 4) {
      throw new Error('Encrypted value has an invalid format');
    }

    const [version, ivValue, authTagValue, ciphertextValue] = parts;

    if (version !== ENCRYPTED_VALUE_VERSION || !ivValue || !authTagValue || !ciphertextValue) {
      throw new Error('Encrypted value has an invalid format');
    }

    const iv = Buffer.from(ivValue, 'base64url');
    const authTag = Buffer.from(authTagValue, 'base64url');
    const ciphertext = Buffer.from(ciphertextValue, 'base64url');

    if (iv.length !== AES_GCM_IV_BYTES || authTag.length !== AES_GCM_AUTH_TAG_BYTES) {
      throw new Error('Encrypted value has invalid metadata');
    }

    const decipher = createDecipheriv('aes-256-gcm', this.key, iv, {
      authTagLength: AES_GCM_AUTH_TAG_BYTES,
    });
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }
}
