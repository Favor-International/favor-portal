// Password hashing on the Workers runtime: PBKDF2-SHA256 via WebCrypto
// (no native bcrypt/argon2 available). Format: pbkdf2$<iterations>$<saltB64>$<hashB64>.

const ITERATIONS = 100_000;
const KEY_BYTES = 32;

function toB64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(b64: string): Uint8Array {
  const s = atob(b64);
  const arr = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i);
  return arr;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as unknown as BufferSource, iterations },
    material,
    KEY_BYTES * 8,
  );
  return new Uint8Array(bits);
}

export const PASSWORD_MIN_LENGTH = 10;

export function passwordMeetsPolicy(password: string): boolean {
  return typeof password === "string" && password.length >= PASSWORD_MIN_LENGTH && password.length <= 200;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toB64(salt)}$${toB64(hash)}`;
}

// A hash of a value nobody can supply. Verifying against this costs the same
// as verifying a real password, so an unknown account cannot be identified by
// how fast it is rejected.
const DUMMY_HASH = `pbkdf2${ITERATIONS}${toB64(new Uint8Array(16))}${toB64(new Uint8Array(32))}`;

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  // Never return early for a missing or malformed hash: do the same work, then
  // fail. Otherwise response time reveals which emails have accounts.
  const usable = typeof stored === "string" && stored.startsWith("pbkdf2$") ? stored : DUMMY_HASH;
  const real = usable === stored;
  const parts = usable.split("$");
  if (parts.length !== 4) return false;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations < 10_000 || iterations > 10_000_000) return false;
  let salt: Uint8Array;
  let expected: Uint8Array;
  try {
    salt = fromB64(parts[2]);
    expected = fromB64(parts[3]);
  } catch {
    // A corrupt row must fail the login, not 500 the request.
    return false;
  }
  const actual = await derive(password, salt, iterations);
  if (expected.length !== actual.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ actual[i];
  return real && diff === 0;
}
