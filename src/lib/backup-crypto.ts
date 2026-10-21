/**
 * Password-protected backup files, compatible with the Ayudhas Pro app (its backupCrypto.ts).
 *
 * The backup JSON is encrypted in the browser with AES-256-GCM (authenticated: a wrong password or any change to
 * the file is detected). The key comes from the password with PBKDF2-HMAC-SHA256, a random 16-byte salt and
 * 210,000 iterations; each file gets a random 12-byte nonce. The envelope's header (format, KDF and cipher
 * parameters) is bound to the ciphertext as additional authenticated data. Same envelope, same bytes as the app,
 * so a file made on either side opens on the other.
 *
 * Uses the browser's Web Crypto API only. The password is never sent anywhere or stored; if it's forgotten the
 * backup can't be opened.
 */

export const ENCRYPTED_TYPE = "AYUDHAS_ENCRYPTED_BACKUP";
export const ENCRYPTED_VERSION = 1;
export const DEFAULT_ITERATIONS = 210_000;
/** Accepted on import: low values are unsafe, huge ones would freeze the page. */
const MIN_ITERATIONS = 100_000;
const MAX_ITERATIONS = 5_000_000;
export const MIN_PASSWORD_LENGTH = 8;

export type EncryptedEnvelope = {
  type: typeof ENCRYPTED_TYPE;
  version: number;
  kdf: { name: "PBKDF2-SHA256"; iterations: number; salt: string };
  cipher: { name: "AES-256-GCM"; nonce: string };
  /** Base64 ciphertext with the 16-byte GCM tag appended. */
  data: string;
};

export class BackupPasswordError extends Error {
  constructor(message = "That password doesn't open this backup, or the file has been changed or damaged.") {
    super(message);
    this.name = "BackupPasswordError";
  }
}

export function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  let s: string;
  try {
    s = atob(b64.replace(/\s+/g, ""));
  } catch {
    throw new BackupPasswordError("This encrypted backup is damaged.");
  }
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

const utf8 = (s: string) => new TextEncoder().encode(s);

/** The authenticated header: everything except the ciphertext (same bytes as the app). */
const headerOf = (e: Omit<EncryptedEnvelope, "data">) =>
  utf8(JSON.stringify([e.type, e.version, e.kdf.name, e.kdf.iterations, e.kdf.salt, e.cipher.name, e.cipher.nonce]));

export function passwordProblem(password: string, confirm?: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (confirm !== undefined && password !== confirm) return "The two passwords don't match.";
  return null;
}

function subtle(): SubtleCrypto {
  if (!globalThis.crypto?.subtle) throw new Error("This browser can't encrypt files here. Open the site over https in an up-to-date browser.");
  return globalThis.crypto.subtle;
}

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const base = await subtle().importKey("raw", utf8(password), "PBKDF2", false, ["deriveKey"]);
  return subtle().deriveKey({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

/** Encrypts backup JSON text with a password. */
export async function encryptBackup(json: string, password: string, iterations = DEFAULT_ITERATIONS): Promise<EncryptedEnvelope> {
  const problem = passwordProblem(password);
  if (problem) throw new BackupPasswordError(problem);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const head: Omit<EncryptedEnvelope, "data"> = {
    type: ENCRYPTED_TYPE,
    version: ENCRYPTED_VERSION,
    kdf: { name: "PBKDF2-SHA256", iterations, salt: toBase64(salt) },
    cipher: { name: "AES-256-GCM", nonce: toBase64(nonce) },
  };
  const key = await deriveKey(password, salt, iterations);
  const sealed = await subtle().encrypt({ name: "AES-GCM", iv: nonce, additionalData: headerOf(head), tagLength: 128 }, key, utf8(json));
  return { ...head, data: toBase64(new Uint8Array(sealed)) };
}

/** True when a parsed file is a password-protected backup. */
export function isEncryptedBackup(v: unknown): v is EncryptedEnvelope {
  return !!v && typeof v === "object" && (v as { type?: unknown }).type === ENCRYPTED_TYPE;
}

/** Decrypts to the backup JSON text. A wrong password or tampering throws BackupPasswordError. */
export async function decryptBackup(env: EncryptedEnvelope, password: string): Promise<string> {
  if (env.version !== ENCRYPTED_VERSION) throw new BackupPasswordError("This encrypted backup was made by a newer version. Update the app and try again.");
  if (env.kdf?.name !== "PBKDF2-SHA256" || env.cipher?.name !== "AES-256-GCM") throw new BackupPasswordError("This encrypted backup uses an unknown format.");
  const it = env.kdf.iterations;
  if (!Number.isInteger(it) || it < MIN_ITERATIONS || it > MAX_ITERATIONS) throw new BackupPasswordError("This encrypted backup is damaged.");
  const salt = fromBase64(env.kdf.salt);
  const nonce = fromBase64(env.cipher.nonce);
  if (salt.length !== 16 || nonce.length !== 12 || typeof env.data !== "string") throw new BackupPasswordError("This encrypted backup is damaged.");
  const key = await deriveKey(password, salt, it);
  try {
    const plain = await subtle().decrypt({ name: "AES-GCM", iv: nonce, additionalData: headerOf(env), tagLength: 128 }, key, fromBase64(env.data));
    return new TextDecoder().decode(plain);
  } catch {
    throw new BackupPasswordError();
  }
}
