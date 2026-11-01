import { NextRequest, NextResponse } from 'next/server';
import { seedDb } from '@/lib/db/seed';
import { verifyGoogleIdToken, authenticateGoogleUser } from '@/lib/auth/google';
import { verifyRecaptchaToken } from '@/lib/auth/recaptcha';

export async function POST(req: NextRequest) {
  await seedDb();
  const remoteIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown_ip';

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid Google authentication request' }, { status: 400 });
    }

    const { credential, recaptchaToken, mockAdmin } = body;

    // Optional Google reCAPTCHA check if token was supplied
    if (recaptchaToken) {
      const captchaResult = await verifyRecaptchaToken(recaptchaToken, remoteIp, 'google_login');
      if (!captchaResult.success) {
        return NextResponse.json({ error: captchaResult.error || 'reCAPTCHA verification failed' }, { status: 403 });
      }
    }

    // Determine target ID token (supporting quick admin Google demo if requested in dev)
    const tokenToVerify = mockAdmin
      ? 'mock_google_admin_token'
      : credential;

    if (!tokenToVerify) {
      return NextResponse.json({ error: 'Missing Google credentials token.' }, { status: 400 });
    }

    // 1. Verify Google Identity token
    const tokenCheck = await verifyGoogleIdToken(tokenToVerify);
    if (!tokenCheck.success || !tokenCheck.payload) {
      return NextResponse.json(
        { error: tokenCheck.error || 'Failed to verify Google ID token' },
        { status: 401 }
      );
    }

    // 2. Authenticate user with JPA Admin isolation
    const authResult = await authenticateGoogleUser(tokenCheck.payload, remoteIp);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      token: authResult.token,
      user: authResult.user,
      securityProtocol: 'Google Identity Services + reCAPTCHA Protection',
    });
  } catch (err: any) {
    console.error('Google authentication API error:', err);
    return NextResponse.json({ error: 'Google authentication service failure.' }, { status: 500 });
  }
}

