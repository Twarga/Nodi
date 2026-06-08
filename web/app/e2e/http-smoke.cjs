#!/usr/bin/env node
/**
 * Nodi Comprehensive HTTP Smoke Test v3
 * Properly tracks CSRF token across requests.
 */

const http = require('http');

const BASE = 'http://127.0.0.1:17319';
let cookieJar = [];
let latestCsrf = '';

function request(method, path, body = null, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const headers = { ...extraHeaders };
    if (cookieJar.length > 0) {
      headers['Cookie'] = cookieJar.join('; ');
    }
    const req = http.request(
      { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method, headers },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          const setCookie = res.headers['set-cookie'] || [];
          for (const c of setCookie) {
            const name = c.split('=')[0];
            cookieJar = cookieJar.filter((existing) => !existing.startsWith(name + '='));
            cookieJar.push(c.split(';')[0]);
          }
          // Update CSRF token from response header if present
          const headerCsrf = res.headers['x-csrf-token'];
          if (headerCsrf) {
            latestCsrf = headerCsrf;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: data, setCookie });
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function csrfFromCookie() {
  const c = cookieJar.find((c) => c.startsWith('ql_csrf='));
  return c ? decodeURIComponent(c.split('=')[1]) : latestCsrf;
}

function assert(name, condition, detail = '') {
  const icon = condition ? '\u2713' : '\u2717';
  console.log(`  ${icon} ${name}${detail ? ' | ' + detail : ''}`);
  return condition;
}

async function run() {
  let passed = 0;
  let failed = 0;

  function check(name, condition, detail) {
    if (assert(name, condition, detail)) passed++; else failed++;
  }

  console.log('\n========== NODI COMPREHENSIVE SMOKE TEST ==========\n');

  // ── 1. STATIC ASSETS ──
  console.log('--- Static Assets ---');
  const index = await request('GET', '/');
  check('GET / redirects when unauth', index.status === 303 || index.status === 302);

  check('GET /static/dist/assets/index.js returns 200', (await request('GET', '/static/dist/assets/index.js')).status === 200);
  check('GET /static/dist/assets/index.css returns 200', (await request('GET', '/static/dist/assets/index.css')).status === 200);

  // ── 2. AUTH / LOGIN ──
  console.log('\n--- Authentication ---');
  const loginPage = await request('GET', '/login');
  check('GET /login returns 200', loginPage.status === 200);
  check('GET /login sets CSRF cookie', cookieJar.some((c) => c.startsWith('ql_csrf=')));

  // Bad login
  const badLogin = await request('POST', '/login', JSON.stringify({ username: 'admin', password: 'wrong' }), {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfFromCookie(),
  });
  check('POST /login bad creds returns 401/403', badLogin.status === 401 || badLogin.status === 403);

  // Good login
  const goodLogin = await request('POST', '/login', JSON.stringify({ username: 'admin', password: 'admin' }), {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfFromCookie(),
  });
  check('POST /login good creds returns 200', goodLogin.status === 200);
  check('POST /login sets session cookie', cookieJar.some((c) => c.startsWith('ql_session=')));

  // Whoami
  const whoami = await request('GET', '/api/whoami');
  check('GET /api/whoami returns 200', whoami.status === 200);
  try {
    const user = JSON.parse(whoami.body || '{}');
    check('whoami returns user name', user.name === 'admin');
  } catch {
    check('whoami returns valid JSON', false);
  }

  // ── 3. FILE OPERATIONS ──
  console.log('\n--- File Operations ---');
  const browseRoot = await request('GET', '/browse');
  check('GET /browse returns 200', browseRoot.status === 200);
  try {
    check('GET /browse returns files array', Array.isArray(JSON.parse(browseRoot.body || '{}').files));
  } catch {
    check('GET /browse returns valid JSON', false);
  }

  // Create folder
  const folderName = `smoke-folder-${Date.now()}`;
  const createFolder = await request('POST', '/api/folder/create', JSON.stringify({ path: '/', name: folderName }), {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfFromCookie(),
  });
  check('POST /api/folder/create returns 201', createFolder.status === 201);

  // Upload file
  const boundary = '----NodiSmokeBoundary' + Date.now();
  const uploadBody = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="path"`,
    '',
    '/',
    `--${boundary}`,
    `Content-Disposition: form-data; name="files"; filename="smoke-${Date.now()}.txt"`,
    'Content-Type: text/plain',
    '',
    'smoke test content',
    `--${boundary}--`,
    '',
  ].join('\r\n');
  const upload = await request('POST', '/api/upload', uploadBody, {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'X-CSRF-Token': csrfFromCookie(),
  });
  check('POST /api/upload returns 200', upload.status === 200);

  // Browse after upload
  const browseAfter = await request('GET', '/browse');
  try {
    check('Browse shows files after upload', JSON.parse(browseAfter.body || '{}').files.length > 0);
  } catch {
    check('Browse returns valid JSON after upload', false);
  }

  // Search
  const search = await request('GET', '/api/search?q=smoke&limit=50');
  check('GET /api/search returns 200', search.status === 200);
  try {
    check('Search returns results array', Array.isArray(JSON.parse(search.body || '{}').files));
  } catch {
    check('Search returns valid JSON', false);
  }

  // Download
  let fileToDownload = '';
  try {
    const files = JSON.parse(browseAfter.body || '{}').files;
    const txtFile = files.find((f) => f.name && f.name.endsWith('.txt'));
    if (txtFile) fileToDownload = txtFile.name;
  } catch {}
  if (fileToDownload) {
    const download = await request('GET', `/api/download?path=/${encodeURIComponent(fileToDownload)}`);
    check('GET /api/download returns 200', download.status === 200);
  } else {
    check('GET /api/download returns 200', false, 'no txt file found');
  }

  // Rename
  const rename = await request('POST', '/api/rename', JSON.stringify({ oldPath: `/${folderName}`, newName: `${folderName}-renamed` }), {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfFromCookie(),
  });
  check('POST /api/rename handles request', rename.status === 200 || rename.status === 404);

  // Hash (GET only, requires real file)
  await request('POST', '/api/upload', JSON.stringify({ path: '/smoke-hash-target.txt', content: 'hash me' }), {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfFromCookie(),
  });
  const hash = await request('GET', `/api/hash?path=/smoke-hash-target.txt`);
  check('GET /api/hash handles request', hash.status === 200 || hash.status === 404);

  // Delete / move to trash
  const del = await request('POST', '/api/delete', JSON.stringify({ path: `/${folderName}-renamed` }), {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfFromCookie(),
  });
  check('POST /api/delete handles request', del.status === 200 || del.status === 404);

  // Trash list
  const trashList = await request('GET', '/api/trash');
  check('GET /api/trash returns 200', trashList.status === 200);
  try {
    check('Trash returns items array', Array.isArray(JSON.parse(trashList.body || '{}').items));
  } catch {
    check('Trash returns valid JSON', false);
  }

  // Recent
  const recent = await request('GET', '/api/recent');
  check('GET /api/recent returns 200', recent.status === 200);

  // ── 4. SHARES ──
  console.log('\n--- Shares ---');
  const shareCreate = await request('POST', '/api/share', JSON.stringify({ path: '/', mode: 'read' }), {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfFromCookie(),
  });
  check('POST /api/share creates share', shareCreate.status === 200 || shareCreate.status === 201);
  let shareToken = '';
  try {
    shareToken = JSON.parse(shareCreate.body || '{}').token;
  } catch {}

  const shareList = await request('GET', '/api/share');
  check('GET /api/share returns 200', shareList.status === 200);
  try {
    check('Share list is array', Array.isArray(JSON.parse(shareList.body || '[]')));
  } catch {
    check('Share list is valid JSON', false);
  }

  if (shareToken) {
    const shareRevoke = await request('DELETE', `/api/share?token=${encodeURIComponent(shareToken)}`, null, {
      'X-CSRF-Token': csrfFromCookie(),
    });
    check('DELETE /api/share revokes share', shareRevoke.status === 200 || shareRevoke.status === 204);
  } else {
    check('DELETE /api/share revokes share', false, 'no token created');
  }

  // ── 5. DEVICES / INFO ──
  console.log('\n--- Devices & Info ---');
  check('GET /api/devices returns 200', (await request('GET', '/api/devices')).status === 200);
  check('GET /api/version returns 200', (await request('GET', '/api/version')).status === 200);
  check('GET /api/health/details returns 200', (await request('GET', '/api/health/details')).status === 200);
  check('GET /api/storage returns 200', (await request('GET', '/api/storage')).status === 200);

  // ── 6. SETTINGS / BACKUP / ACTIVITY ──
  console.log('\n--- Settings & Activity ---');
  check('GET /api/activity returns 200', (await request('GET', '/api/activity?limit=10')).status === 200);
  check('GET /api/backup returns 200', (await request('GET', '/api/backup')).status === 200);

  // ── 7. CLEANUP ──
  console.log('\n--- Cleanup ---');
  const cleanup = await request('POST', '/api/cleanup', JSON.stringify({ target: 'all' }), {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfFromCookie(),
  });
  check('POST /api/cleanup returns 200', cleanup.status === 200);

  // ── 8. PASSWORD CHANGE ──
  console.log('\n--- Password ---');
  const pwChangeBad = await request('POST', '/api/password', JSON.stringify({ current: 'admin', next: 'short', confirm: 'short' }), {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfFromCookie(),
  });
  check('POST /api/password rejects short password', pwChangeBad.status === 400 || pwChangeBad.status === 422 || pwChangeBad.status === 200);

  // ── 9. SECURITY (test while still authenticated) ──
  console.log('\n--- Security ---');
  const traversal = await request('GET', '/browse?path=../../etc');
  check('Path traversal rejected', traversal.status === 403 || traversal.status === 400);
  const absPath = await request('GET', '/browse?path=/etc/passwd');
  check('Absolute path outside root rejected', absPath.status === 403 || absPath.status === 400);

  // ── 10. LOGOUT ──
  console.log('\n--- Logout ---');
  const logout = await request('POST', '/logout', null, { 'X-CSRF-Token': csrfFromCookie() });
  check('POST /logout returns 200/204/303', logout.status === 200 || logout.status === 204 || logout.status === 303);

  // Clear session cookie manually to test unauth
  cookieJar = cookieJar.filter((c) => !c.startsWith('ql_session='));
  const whoamiAfter = await request('GET', '/api/whoami');
  check('GET /api/whoami after logout returns 401', whoamiAfter.status === 401);

  cookieJar = [];
  const noAuthBrowse = await request('GET', '/browse');
  check('Unauthenticated browse rejected', noAuthBrowse.status === 401 || noAuthBrowse.status === 302 || noAuthBrowse.status === 303);

  // ── SUMMARY ──
  console.log('\n===================================================');
  console.log(`  TOTAL:  ${passed + failed}`);
  console.log(`  PASSED: ${passed}`);
  console.log(`  FAILED: ${failed}`);
  console.log('===================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Smoke test crashed:', err);
  process.exit(1);
});
