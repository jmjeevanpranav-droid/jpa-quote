import { SignJWT, jwtVerify } from 'jose';

export interface UserSession {
  userId: string;
  email: string;
  name: string;
  role: 'admin' | 'staff';
  contact?: string;
  sessionId?: string;
  avatarUrl?: string;
  picture?: string;
}

const DEFAULT_JWT_SECRET = 'jpa_quote_builder_master_cybersecurity_sha256_key_9790600971_coimbatore_strict';
const SECRET_STRING = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;

function getSigningKey(): Uint8Array {
  return new TextEncoder().encode(SECRET_STRING);
}

export const SESSION_COOKIE_NAME = 'jpa_session_token';

/**
 * Signs a tamper-proof HS256 JWT with configurable expiration (30 days for remember me, 7 days default)
 */
export async function signSessionToken(user: UserSession, rememberMe: boolean = false): Promise<string> {
  const sessionId = user.sessionId || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  return await new SignJWT({ ...user, sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(rememberMe ? '30d' : '7d')
    .sign(getSigningKey());
}

/**
 * Cryptographically verifies and decodes the session token
 */
export async function verifySessionToken(token: string): Promise<UserSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSigningKey());
    return {
      userId: String(payload.userId),
      email: String(payload.email),
      name: String(payload.name),
      role: (payload.role as 'admin' | 'staff') || 'staff',
      contact: payload.contact ? String(payload.contact) : undefined,
      sessionId: payload.sessionId ? String(payload.sessionId) : undefined,
      avatarUrl: payload.avatarUrl ? String(payload.avatarUrl) : (payload.picture ? String(payload.picture) : undefined),
      picture: payload.picture ? String(payload.picture) : (payload.avatarUrl ? String(payload.avatarUrl) : undefined),
    };
  } catch {
    return null;
  }
}
