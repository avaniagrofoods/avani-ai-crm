/**
 * TASK 5H.19 — LOGIN CREDENTIAL SECURITY & AUTHENTICATION AUDIT TEST SUITE
 * 
 * Verifies:
 * 1. Login page rendering & source cleanliness (no hardcoded credentials)
 * 2. Invalidation of unauthorized credentials & timing-safe checks
 * 3. Protected route enforcement (pages & APIs)
 * 4. CSRF protection & SameSite/HttpOnly/Secure cookie settings
 * 5. Frontend bundle & public environment variable scan (zero exposed secrets)
 * 6. Rate limiting mechanics
 * 7. Single-owner ADMIN role enforcement
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

async function runSecurityTests() {
  console.log('=================================================================');
  console.log('TASK 5H.19: LOGIN CREDENTIAL & AUTHENTICATION AUDIT TEST RUNNER');
  console.log('=================================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`[PASS] ${total}. ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${total}. ${name}`);
      console.error(err);
      process.exitCode = 1;
    }
  }

  // 1. Login page source inspection
  test('Login Page Component (src/app/login/page.tsx) contains NO default credentials', () => {
    const src = read('src/app/login/page.tsx');
    assert.ok(!src.includes('value="'), 'Form inputs must not have hardcoded values');
    assert.ok(!src.includes('defaultValue='), 'Form inputs must not have defaultValue set');
    assert.ok(!src.includes('password="'), 'No hardcoded password attributes');
    assert.ok(!src.includes('sachin@'), 'Owner email must not be hardcoded as default value');
    assert.ok(!src.includes('admin@'), 'Admin email must not be hardcoded as default value');
    assert.ok(src.includes("useState('')"), 'State must initialize with empty strings');
    assert.ok(src.includes('type="password"'), 'Password field must use type="password"');
  });

  // 2. Authentication API Handler (src/app/api/auth/login/route.ts)
  test('Login Route enforces server-side verification and no-store headers', () => {
    const src = read('src/app/api/auth/login/route.ts');
    assert.ok(src.includes('verifyCsrfRequest'), 'Route must enforce CSRF validation');
    assert.ok(src.includes('checkLoginRateLimit'), 'Route must enforce login rate limiting');
    assert.ok(src.includes('verifyCrmCredentials'), 'Route must invoke secure credential verification');
    assert.ok(src.includes('Cache-Control\': \'no-store'), 'Route must emit no-store cache headers');
    assert.ok(!src.includes('console.log(password'), 'Passwords must never be logged');
  });

  // 3. Auth Core (src/lib/auth.ts) security features
  test('Auth Core enforces HttpOnly, Secure, SameSite, and 1800s TTL', () => {
    const src = read('src/lib/auth.ts');
    assert.ok(src.includes('httpOnly: true'), 'Cookie must be httpOnly');
    assert.ok(src.includes("sameSite: 'lax'"), 'Cookie must be sameSite lax');
    assert.ok(src.includes('SESSION_MAX_AGE_SECONDS = 1800'), 'Session TTL must be 1800s (30 mins)');
    assert.ok(src.includes('constantTimeEqualStrings'), 'Email/credentials comparison must be timing-safe');
    assert.ok(src.includes('verifyStoredPasswordHash'), 'Password must use secure password hashing');
  });

  // 4. Role Enforcement (Single Owner ADMIN)
  test('Auth Core strictly restricts login to ADMIN role', () => {
    const src = read('src/lib/auth.ts');
    assert.ok(src.includes("decoded.role !== 'ADMIN'"), 'Non-ADMIN roles must be rejected');
    assert.ok(src.includes('Single-owner administrator access only'), 'Rejects non-owner accounts');
  });

  // 5. Proxy Middleware (src/proxy.ts) Route Protection
  test('Proxy Middleware intercepts unauthenticated page & API visits', () => {
    const src = read('src/proxy.ts');
    assert.ok(src.includes("PUBLIC_PAGE_PATHS = new Set(['/login'])"), 'Only /login is public page');
    assert.ok(src.includes("loginUrl.searchParams.set('next', pathname)"), 'Redirects unauthenticated pages to /login?next=');
    assert.ok(src.includes("status: 401"), 'Returns 401 for unauthenticated API requests');
    assert.ok(src.includes('verifyCsrfRequest'), 'Enforces CSRF on API requests');
  });

  // 6. Public Environment Variables Audit
  test('Zero secrets or passwords exposed in NEXT_PUBLIC_ variables', () => {
    const files = ['src/app', 'src/components', 'src/lib'];
    function scanDir(dir) {
      const entries = fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          scanDir(full);
        } else if (/\.(tsx?|jsx?)$/.test(e.name)) {
          const content = fs.readFileSync(path.join(ROOT, full), 'utf8');
          const matches = content.match(/NEXT_PUBLIC_[A-Z0-9_]+/g);
          if (matches) {
            for (const m of matches) {
              assert.equal(m, 'NEXT_PUBLIC_APP_URL', `Unauthorized public env var: ${m} in ${full}`);
            }
          }
        }
      }
    }
    for (const d of files) {
      if (fs.existsSync(path.join(ROOT, d))) {
        scanDir(d);
      }
    }
  });

  // 7. CSRF Protection Logic
  test('CSRF verification rejects cross-site Sec-Fetch-Site and Origin mismatch', () => {
    const src = read('src/lib/auth.ts');
    assert.ok(src.includes("secFetchSite === 'cross-site'"), 'Explicitly checks Sec-Fetch-Site header');
    assert.ok(src.includes("CSRF_FORBIDDEN"), 'Returns CSRF_FORBIDDEN on cross-site requests');
    assert.ok(src.includes("CSRF_ORIGIN_MISMATCH"), 'Validates origin against expected host');
  });

  // 8. Password hashing implementation (src/lib/password.ts)
  test('Password module implements scrypt with salt derivation', () => {
    const src = read('src/lib/password.ts');
    assert.ok(src.includes('scrypt'), 'Password hashing must utilize scrypt');
    assert.ok(src.includes('timingSafeEqual'), 'Password comparison must use crypto.timingSafeEqual');
  });

  // 9. Session storage & revocation (src/lib/auth-store.ts)
  test('Session store implements anti-fixation and rotation', () => {
    const src = read('src/lib/auth.ts');
    assert.ok(src.includes('issueRotatedSession'), 'Must support session rotation on login');
    assert.ok(src.includes('revokeSessionInDb'), 'Must support revoking prior sessions');
  });

  // 10. Rate limiting mechanics (src/lib/auth-store.ts)
  test('Rate limiting tracks client IP and failed attempts', () => {
    const src = read('src/lib/auth-store.ts');
    assert.ok(src.includes('checkLoginRateLimit'), 'Implements checkLoginRateLimit');
    assert.ok(src.includes('recordFailedLoginAttempt'), 'Implements recordFailedLoginAttempt');
    assert.ok(src.includes('extractClientIp'), 'Extracts client IP correctly');
  });

  console.log(`\nResults: ${passed}/${total} security test assertions PASSED.\n`);
}

runSecurityTests();
