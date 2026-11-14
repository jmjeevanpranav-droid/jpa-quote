import { cookies, headers } from 'next/headers';
import {
  UserSession,
  SESSION_COOKIE_NAME,
  signSessionToken,
  verifySessionToken,
} from './tokens';

export type { UserSession };
export { SESSION_COOKIE_NAME, signSessionToken, verifySessionToken };

export async function createSession(user: UserSession, rememberMe: boolean = false): Promise<string> {
  const token = await signSessionToken(user, rememberMe);
  try {
    const headerList = await headers();
    const forwardedProto = headerList.get('x-forwarded-proto');
    const isHttps = forwardedProto === 'https' || Boolean(process.env.SPACE_ID || process.env.VERCEL);
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: isHttps ? 'none' : 'lax',
      path: '/',
      maxAge: rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60,
    });
  } catch {
    // In test runner or non-request context, cookies() is safely skipped
  }

  return token;
}

export async function getSession(req?: Request): Promise<UserSession | null> {
  try {
    let token: string | undefined;

    // 1. Check req headers if passed
    if (req) {
      const auth = req.headers.get('authorization');
      if (auth?.startsWith('Bearer ')) token = auth.substring(7).trim();
      if (!token) token = req.headers.get('x-jpa-session-token') || undefined;
      if (!token) {
        const cookieHeader = req.headers.get('cookie');
        if (cookieHeader) {
          const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]*)`));
          if (match) token = decodeURIComponent(match[1]);
        }
      }
    }

    // 2. Check Next.js headers()
    if (!token) {
      try {
        const headerList = await headers();
        const auth = headerList.get('authorization');
        if (auth?.startsWith('Bearer ')) token = auth.substring(7).trim();
        if (!token) token = headerList.get('x-jpa-session-token') || undefined;
      } catch {}
    }

    // 3. Check cookies
    if (!token) {
      try {
        const cookieStore = await cookies();
        token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
      } catch {}
    }

    if (!token) return null;
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

export async function clearSession() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE_NAME);
  } catch {}
}
