import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const secret = process.env.APP_SECRET || 'default-fallback-app-secret-32ch';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypt a plaintext string using AES-256-GCM
 * Returns string format: iv:tag:ciphertext (hex encoded)
 */
export function encrypt(text: string): string {
  if (!text) return '';
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const tag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt an AES-256-GCM encrypted string
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return '';
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      // In case the value was saved unencrypted
      return encryptedText;
    }

    const [ivHex, tagHex, ciphertextHex] = parts;
    const key = getKey();
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    console.error('Decryption failed, returning empty or fallback:', err);
    return '';
  }
}

