import crypto from 'node:crypto';

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
const SCRYPT_KEY_BYTES = 64;
const LEGACY_SHA256_RE = /^[a-f0-9]{64}$/i;

// Per-process salted cache for env-provided plaintext credentials so raw plaintext
// is hashed immediately via scrypt rather than stored or compared in plaintext.
const envDerivedCache = new Map<string, string>();

function deriveScryptAsync(password: string, saltHex: string, params = SCRYPT_PARAMS): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      Buffer.from(saltHex, 'hex'),
      SCRYPT_KEY_BYTES,
      params,
      (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      }
    );
  });
}

function derivePbkdf2Async(password: string, saltHex: string, iterations: number, keyLen: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(
      password,
      Buffer.from(saltHex, 'hex'),
      iterations,
      keyLen,
      'sha256',
      (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      }
    );
  });
}

export async function hashPasswordScrypt(password: string): Promise<string> {
  const saltHex = crypto.randomBytes(16).toString('hex');
  const derived = await deriveScryptAsync(password, saltHex);
  return `scrypt$${saltHex}$${derived.toString('hex')}`;
}

export async function verifyStoredPasswordHash(password: string, storedHash: string): Promise<boolean> {
  if (!password || !storedHash) return false;
  const trimmed = storedHash.trim();

  if (trimmed.startsWith('scrypt$')) {
    const parts = trimmed.split('$');
    if (parts.length !== 3) return false;
    const [, saltHex, hashHex] = parts;
    if (!saltHex || !hashHex || !/^[a-f0-9]+$/i.test(saltHex) || !/^[a-f0-9]+$/i.test(hashHex)) {
      return false;
    }
    const expectedBuf = Buffer.from(hashHex, 'hex');
    const derived = await deriveScryptAsync(password, saltHex);
    if (derived.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(derived, expectedBuf);
  }

  if (trimmed.startsWith('pbkdf2_sha256$')) {
    const parts = trimmed.split('$');
    if (parts.length !== 4) return false;
    const iter = Number(parts[1]);
    const saltHex = parts[2];
    const hashHex = parts[3];
    if (!Number.isFinite(iter) || iter < 100000 || !saltHex || !hashHex) return false;
    const expectedBuf = Buffer.from(hashHex, 'hex');
    const derived = await derivePbkdf2Async(password, saltHex, iter, expectedBuf.length);
    if (derived.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(derived, expectedBuf);
  }

  // Compatibility bridge for CP-26.3 SHA-256 digests already pinned in Vercel Production env
  if (trimmed.startsWith('sha256$') || LEGACY_SHA256_RE.test(trimmed)) {
    const hex = trimmed.startsWith('sha256$') ? trimmed.slice(7) : trimmed;
    if (!LEGACY_SHA256_RE.test(hex)) return false;
    const expectedBuf = Buffer.from(hex.toLowerCase(), 'hex');
    const inputBuf = crypto.createHash('sha256').update(password, 'utf8').digest();
    if (inputBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(inputBuf, expectedBuf);
  }

  return false;
}

export async function getOrDeriveEnvScryptHash(cacheKey: string, envSecretValue: string): Promise<string> {
  const digestKey = `${cacheKey}:${crypto.createHash('sha256').update(envSecretValue).digest('hex').slice(0, 12)}`;
  const cached = envDerivedCache.get(digestKey);
  if (cached) return cached;
  const computed = await hashPasswordScrypt(envSecretValue);
  envDerivedCache.set(digestKey, computed);
  return computed;
}
