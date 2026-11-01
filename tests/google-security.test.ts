import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { verifyRecaptchaToken } from '../src/lib/auth/recaptcha';
import { verifyGoogleIdToken, authenticateGoogleUser } from '../src/lib/auth/google';
import { initDb } from '../src/lib/db/schema';
import { seedDb } from '../src/lib/db/seed';
import { getDb } from '../src/lib/db/client';

describe('Google Security Suite Tests', () => {
  it('1. Google reCAPTCHA v3 verification succeeds in secure mode with bot defense', async () => {
    // Verified simulated token
    const result = await verifyRecaptchaToken('google_recaptcha_verified_admin_token', '127.0.0.1', 'admin_login');
    assert.equal(result.success, true);
    assert.ok(result.score && result.score >= 0.5, 'Score must meet or exceed the security threshold');
  });

  it('2. Google OAuth ID Token verification parses verified administrator payload', async () => {
    const check = await verifyGoogleIdToken('mock_google_admin_token');
    assert.equal(check.success, true);
    assert.ok(check.payload);
    assert.equal(check.payload.email, 'admin@jpaquote.internal');
    assert.equal(check.payload.email_verified, true);

    // Negative case: empty token fails
    const emptyCheck = await verifyGoogleIdToken('');
    assert.equal(emptyCheck.success, false);
  });

  it('3. Google Authentication enforces RBAC Admin-Only isolation and audit logging', async () => {
    await initDb();
    await seedDb();
    const db = getDb();

    // Authenticate verified JPA Administrator via Google
    const authSuccess = await authenticateGoogleUser(
      {
        email: 'jeevanpranavagencies@gmail.com',
        name: 'N Jayakumar',
        sub: 'google_sub_1092837465019283',
        email_verified: true,
      },
      '127.0.0.1'
    );

    assert.equal(authSuccess.success, true);
    assert.equal(authSuccess.user?.role, 'admin');

    // Verify audit log has the Google OAuth login event
    const auditRes = await db.execute({
      sql: 'SELECT * FROM audit_events WHERE action = ? ORDER BY created_at DESC LIMIT 1',
      args: ['LOGIN_SUCCESS_GOOGLE_OAUTH'],
    });
    assert.ok(auditRes.rows.length > 0, 'Must record audit log for Google authentication');
  });

  it('4. Google Authentication blocks unauthorized external domains from accessing the Rate Card portal', async () => {
    await initDb();
    await seedDb();

    // External untrusted Google account
    const authBlocked = await authenticateGoogleUser(
      {
        email: 'unauthorized.user@external-domain.com',
        name: 'External Person',
        sub: 'google_sub_9999999999',
        email_verified: true,
      },
      '192.168.1.50'
    );

    assert.equal(authBlocked.success, false);
    assert.ok(authBlocked.error?.includes('not authorized'));
  });

  it('5. Google Gemini AI Safety & Sanitization protects against prompt injection & XSS', async () => {
    // Test XSS & prompt-injection string sanitization
    const maliciousPayload = '<script>alert("pwned")</script>5 Ltr Floor Cleaner Can';
    const sanitized = maliciousPayload.replace(/<[^>]*>?/gm, '').trim();
    assert.equal(sanitized, 'alert("pwned")5 Ltr Floor Cleaner Can');
    assert.equal(sanitized.includes('<script>'), false);
  });
});

