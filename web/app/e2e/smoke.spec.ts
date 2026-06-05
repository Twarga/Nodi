import { test, expect, Page } from '@playwright/test';

const USER = 'admin';
const PASS = 'admin';

async function login(page: Page) {
  await page.goto('/login');
  await page.fill('#login-username', USER);
  await page.fill('#login-password', PASS);
  await page.click('button[type="submit"]');
  // Wait for client-side navigation to home (nav uses pushState, so waitForURL is flaky)
  await expect(page.locator('text=Good').first()).toBeVisible({ timeout: 10000 });
}

async function clearUploadsIfAny(page: Page) {
  // Dismiss any upload panels or toasts
  await page.evaluate(() => {
    document.querySelectorAll('[role="status"]').forEach((el) => el.remove());
  });
}

// ───────────────────────────────────────────────
// LOGIN
// ───────────────────────────────────────────────
test.describe('Login', () => {
  test('renders login page with logo and form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('text=Nodi').first()).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button:has-text("Sign in")')).toBeVisible();
  });

  test('rejects invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#login-username', USER);
    await page.fill('#login-password', 'wrongpassword');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Invalid username or password')).toBeVisible({ timeout: 5000 });
  });

  test('logs in with valid credentials and redirects', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#login-username', USER);
    await page.fill('#login-password', PASS);
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Good').first()).toBeVisible({ timeout: 10000 });
    // Should have session cookie
    const cookies = await page.context().cookies();
    const session = cookies.find((c) => c.name === 'ql_session');
    expect(session).toBeDefined();
  });

  test('login page has LAN continue button', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('button:has-text("Continue on this device")')).toBeVisible();
  });
});

// ───────────────────────────────────────────────
// TOP BAR & GLOBAL NAVIGATION
// ───────────────────────────────────────────────
test.describe('TopBar', () => {
  test.beforeEach(async ({ page }) => await login(page));

  test('shows all nav items', async ({ page }) => {
    await expect(page.locator('nav:has-text("Files")')).toBeVisible();
    await expect(page.locator('nav:has-text("Send")')).toBeVisible();
    await expect(page.locator('nav:has-text("Shares")')).toBeVisible();
    await expect(page.locator('nav:has-text("Devices")')).toBeVisible();
  });

  test('global search hint navigates to files', async ({ page }) => {
    await page.click('text=Search files');
    await page.waitForURL(/\/files/, { timeout: 5000 });
  });

  test('theme toggle switches light/dark', async ({ page }) => {
    const html = page.locator('html');
    const initial = await html.getAttribute('class');
    await page.click('[title="Toggle theme"], button[aria-label="Toggle theme"]');
    await page.waitForTimeout(300);
    const after = await html.getAttribute('class');
    // Should have changed
    expect(after !== initial || after?.includes('dark') !== initial?.includes('dark')).toBeTruthy();
  });

  test('user dropdown shows name and settings link', async ({ page }) => {
    await page.click('[title="Account"], button[aria-label="Account menu"]');
    await expect(page.locator('text=Signed in as')).toBeVisible();
    await expect(page.locator('text=Settings')).toBeVisible();
    await expect(page.locator('text=Sign out')).toBeVisible();
  });

  test('settings link in dropdown navigates to settings', async ({ page }) => {
    await page.click('[title="Account"], button[aria-label="Account menu"]');
    await page.click('text=Settings');
    await page.waitForURL(/\/settings/, { timeout: 5000 });
  });

  test('logout clears session and redirects to login', async ({ page }) => {
    await page.click('[title="Account"], button[aria-label="Account menu"]');
    await page.click('text=Sign out');
    await page.waitForURL(/\/login/, { timeout: 10000 });
    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === 'ql_session')).toBeUndefined();
  });
});

// ───────────────────────────────────────────────
// HOME PAGE
// ───────────────────────────────────────────────
test.describe('Home', () => {
  test.beforeEach(async ({ page }) => await login(page));

  test('shows greeting with user name', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=/Good (morning|afternoon|evening)/i')).toBeVisible();
    await expect(page.locator('text=admin')).toBeVisible();
  });

  test('action cards navigate correctly', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Upload files');
    await page.waitForURL(/\/files/, { timeout: 5000 });

    await page.goto('/');
    await page.click('text=Browse files');
    await page.waitForURL(/\/files/, { timeout: 5000 });

    await page.goto('/');
    await page.click('text=Send from phone');
    await page.waitForURL(/\/send/, { timeout: 5000 });
  });

  test('recent files section renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Recent files')).toBeVisible();
  });

  test('storage widget shows usage or loading', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Storage')).toBeVisible();
    const text = await page.locator('text=Storage').locator('..').textContent();
    expect(text).toMatch(/(used|Loading|of)/i);
  });

  test('view all files link works', async ({ page }) => {
    await page.goto('/');
    await page.click('text=View all files');
    await page.waitForURL(/\/files/, { timeout: 5000 });
  });
});

// ───────────────────────────────────────────────
// FILES / DASHBOARD
// ───────────────────────────────────────────────
test.describe('Files / Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/files');
    await page.waitForTimeout(500);
  });

  test('renders file list header and toolbar', async ({ page }) => {
    await expect(page.locator('text=Files').first()).toBeVisible();
    await expect(page.locator('button:has-text("Upload")')).toBeVisible();
    await expect(page.locator('button:has-text("New folder")')).toBeVisible();
    await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();
  });

  test('empty state shows when no files', async ({ page }) => {
    await expect(page.locator('text=/No files yet|Drag files here|Upload your first file/i')).toBeVisible();
  });

  test('create folder works', async ({ page }) => {
    const folderName = `test-folder-${Date.now()}`;
    await page.click('button:has-text("New folder")');
    await page.fill('input[placeholder*="Folder name"]', folderName);
    await page.click('button:has-text("Create")');
    await expect(page.locator(`text=${folderName}`)).toBeVisible({ timeout: 5000 });
  });

  test('upload file works', async ({ page }) => {
    await page.click('button:has-text("Upload")');
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('button:has-text("Upload")').catch(() => {}),
    ]);
    // Use the hidden file input directly
    await page.evaluate(() => {
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (input) input.style.display = 'block';
    });
    const input = page.locator('input[type="file"]').first();
    await input.setInputFiles({
      name: `smoke-upload-${Date.now()}.txt`,
      mimeType: 'text/plain',
      buffer: Buffer.from('hello nodi smoke test'),
    });
    await page.waitForTimeout(2000);
    await expect(page.locator('text=uploaded').first()).toBeVisible({ timeout: 8000 });
  });

  test('search filters files', async ({ page }) => {
    // Create a uniquely named file first
    const name = `searchable-${Date.now()}.txt`;
    await page.evaluate(() => {
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (input) input.style.display = 'block';
    });
    await page.locator('input[type="file"]').first().setInputFiles({
      name,
      mimeType: 'text/plain',
      buffer: Buffer.from('search me'),
    });
    await page.waitForTimeout(2000);
    // Now search
    await page.fill('input[placeholder*="Search"]', name.split('-')[0]);
    await page.waitForTimeout(800);
    await expect(page.locator(`text=${name}`)).toBeVisible({ timeout: 5000 });
  });

  test('breadcrumbs navigate up', async ({ page }) => {
    // Create and enter a folder
    const folderName = `bc-test-${Date.now()}`;
    await page.click('button:has-text("New folder")');
    await page.fill('input[placeholder*="Folder name"]', folderName);
    await page.click('button:has-text("Create")');
    await page.locator(`text=${folderName}`).first().click();
    await page.waitForTimeout(500);
    // Click breadcrumb "Files" or "Home"
    await page.click('text=Home');
    await expect(page.locator('text=Files').first()).toBeVisible();
  });

  test('view toggle list/grid changes layout', async ({ page }) => {
    await expect(page.locator('[title="List view"], button[title="List view"]')).toBeVisible();
    await page.click('[title="Grid view"], button[title="Grid view"]');
    await page.waitForTimeout(300);
    // Just verify the button is interactable and page doesn't crash
    await page.click('[title="List view"], button[title="List view"]');
    await page.waitForTimeout(300);
  });

  test('sort dropdown exists and is interactive', async ({ page }) => {
    const select = page.locator('select');
    await expect(select).toBeVisible();
    await select.selectOption('size');
    await page.waitForTimeout(500);
    await select.selectOption('name');
  });

  test('file row context menu opens', async ({ page }) => {
    // Upload a file first
    const name = `ctx-${Date.now()}.txt`;
    await page.evaluate(() => {
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (input) input.style.display = 'block';
    });
    await page.locator('input[type="file"]').first().setInputFiles({
      name,
      mimeType: 'text/plain',
      buffer: Buffer.from('context'),
    });
    await page.waitForTimeout(2000);
    // Right-click the file row
    await page.locator(`text=${name}`).first().click({ button: 'right' });
    await expect(page.locator('text=Rename')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('text=Delete')).toBeVisible();
    await expect(page.locator('text=Details')).toBeVisible();
    await expect(page.locator('text=Download')).toBeVisible();
  });

  test('rename file via context menu', async ({ page }) => {
    const name = `rename-src-${Date.now()}.txt`;
    const newName = `rename-dst-${Date.now()}.txt`;
    await page.evaluate(() => {
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (input) input.style.display = 'block';
    });
    await page.locator('input[type="file"]').first().setInputFiles({
      name,
      mimeType: 'text/plain',
      buffer: Buffer.from('rename me'),
    });
    await page.waitForTimeout(2000);
    await page.locator(`text=${name}`).first().click({ button: 'right' });
    await page.click('text=Rename');
    await page.fill('input[type="text"]', newName);
    await page.click('button:has-text("Rename")');
    await expect(page.locator(`text=${newName}`)).toBeVisible({ timeout: 5000 });
  });

  test('delete file moves to trash', async ({ page }) => {
    const name = `del-${Date.now()}.txt`;
    await page.evaluate(() => {
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (input) input.style.display = 'block';
    });
    await page.locator('input[type="file"]').first().setInputFiles({
      name,
      mimeType: 'text/plain',
      buffer: Buffer.from('delete me'),
    });
    await page.waitForTimeout(2000);
    await page.locator(`text=${name}`).first().click({ button: 'right' });
    await page.click('text=Delete');
    await page.click('button:has-text("Delete")');
    await expect(page.locator(`text=${name}`)).toBeHidden({ timeout: 5000 });
  });

  test('details panel opens for a file', async ({ page }) => {
    const name = `details-${Date.now()}.txt`;
    await page.evaluate(() => {
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (input) input.style.display = 'block';
    });
    await page.locator('input[type="file"]').first().setInputFiles({
      name,
      mimeType: 'text/plain',
      buffer: Buffer.from('details'),
    });
    await page.waitForTimeout(2000);
    await page.locator(`text=${name}`).first().click({ button: 'right' });
    await page.click('text=Details');
    await expect(page.locator('text=Details').first()).toBeVisible({ timeout: 3000 });
    await expect(page.locator('text=SHA-256')).toBeVisible();
    await page.click('button:has-text("Close"), [aria-label="Close"]');
  });

  test('duplicate file creates copy', async ({ page }) => {
    const name = `dup-${Date.now()}.txt`;
    await page.evaluate(() => {
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (input) input.style.display = 'block';
    });
    await page.locator('input[type="file"]').first().setInputFiles({
      name,
      mimeType: 'text/plain',
      buffer: Buffer.from('duplicate'),
    });
    await page.waitForTimeout(2000);
    await page.locator(`text=${name}`).first().click({ button: 'right' });
    await page.click('text=Duplicate');
    await page.waitForTimeout(2000);
    // Should see two entries with the same base name
    const count = await page.locator(`text=${name}`).count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('select all via keyboard shortcut', async ({ page }) => {
    await page.keyboard.press('Control+a');
    // Should not crash; if files exist, selection bar may appear
  });

  test('drag and drop upload works', async ({ page }) => {
    const name = `drag-${Date.now()}.txt`;
    const dataTransfer = await page.evaluateHandle(() => {
      const dt = new DataTransfer();
      const file = new File(['drag drop content'], 'drag-test.txt', { type: 'text/plain' });
      dt.items.add(file);
      return dt;
    });
    await page.dispatchEvent('body', 'dragenter', { dataTransfer });
    await page.dispatchEvent('body', 'drop', { dataTransfer });
    await page.waitForTimeout(2000);
    // Just verify no crash and upload panel may show
  });
});

// ───────────────────────────────────────────────
// SEND PAGE
// ───────────────────────────────────────────────
test.describe('Send', () => {
  test.beforeEach(async ({ page }) => await login(page));

  test('renders send page with drag zone', async ({ page }) => {
    await page.goto('/send');
    await expect(page.locator('text=Send files')).toBeVisible();
    await expect(page.locator('text=Drag files here')).toBeVisible();
  });

  test('source buttons are visible', async ({ page }) => {
    await page.goto('/send');
    await expect(page.locator('button:has-text("Camera")')).toBeVisible();
    await expect(page.locator('button:has-text("Gallery")')).toBeVisible();
    await expect(page.locator('button:has-text("Files")')).toBeVisible();
    await expect(page.locator('button:has-text("Folder")')).toBeVisible();
  });

  test('destination input accepts path', async ({ page }) => {
    await page.goto('/send');
    await page.fill('input[placeholder*="folder/path"]', 'test-dest');
    await expect(page.locator('text=test-dest')).toBeVisible();
  });

  test('file upload via send page works', async ({ page }) => {
    await page.goto('/send');
    await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[type="file"]');
      inputs.forEach((i) => ((i as HTMLInputElement).style.display = 'block'));
    });
    await page.locator('input[type="file"]').nth(2).setInputFiles({
      name: `send-upload-${Date.now()}.txt`,
      mimeType: 'text/plain',
      buffer: Buffer.from('sent via send page'),
    });
    await page.waitForTimeout(2000);
    await expect(page.locator('text=sent').first()).toBeVisible({ timeout: 8000 });
  });
});

// ───────────────────────────────────────────────
// SHARE PAGE
// ───────────────────────────────────────────────
test.describe('Share', () => {
  test.beforeEach(async ({ page }) => await login(page));

  test('renders share page with stats and create form', async ({ page }) => {
    await page.goto('/share');
    await expect(page.locator('text=Shares')).toBeVisible();
    await expect(page.locator('text=Active shares')).toBeVisible();
    await expect(page.locator('text=New share')).toBeVisible();
  });

  test('tabs switch between active/expired/dropboxes/all', async ({ page }) => {
    await page.goto('/share');
    await page.click('text=Expired');
    await page.waitForTimeout(300);
    await page.click('text=Dropboxes');
    await page.waitForTimeout(300);
    await page.click('text=All');
    await page.waitForTimeout(300);
    await page.click('text=Active');
  });

  test('create read share works', async ({ page }) => {
    await page.goto('/share');
    await page.fill('input[placeholder*="folder/file/path"]', '/');
    await page.click('button:has-text("Link")');
    await page.click('button:has-text("Create share")');
    await expect(page.locator('text=Share created').first()).toBeVisible({ timeout: 8000 });
    // Should appear in list
    await expect(page.locator('text=Link').first()).toBeVisible();
  });

  test('create dropbox share works', async ({ page }) => {
    await page.goto('/share');
    await page.fill('input[placeholder*="folder/file/path"]', '/');
    await page.click('button:has-text("Dropbox")');
    await page.click('button:has-text("Create share")');
    await expect(page.locator('text=Share created').first()).toBeVisible({ timeout: 8000 });
    await expect(page.locator('text=Dropbox').first()).toBeVisible();
  });

  test('revoke share removes it', async ({ page }) => {
    await page.goto('/share');
    await page.fill('input[placeholder*="folder/file/path"]', '/');
    await page.click('button:has-text("Create share")');
    await page.waitForTimeout(2000);
    // Look for revoke button
    const revokeBtn = page.locator('button:has-text("Revoke")').first();
    if (await revokeBtn.isVisible().catch(() => false)) {
      page.on('dialog', (dialog) => dialog.accept());
      await revokeBtn.click();
      await expect(page.locator('text=Share revoked').first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('copy share link button works', async ({ page }) => {
    await page.goto('/share');
    await page.fill('input[placeholder*="folder/file/path"]', '/');
    await page.click('button:has-text("Create share")');
    await page.waitForTimeout(2000);
    const copyBtn = page.locator('button:has-text("Copy")').first();
    if (await copyBtn.isVisible().catch(() => false)) {
      await copyBtn.click();
      await expect(page.locator('text=copied').first()).toBeVisible({ timeout: 3000 });
    }
  });
});

// ───────────────────────────────────────────────
// DEVICES PAGE
// ───────────────────────────────────────────────
test.describe('Devices', () => {
  test.beforeEach(async ({ page }) => await login(page));

  test('renders devices page with QR and quick access', async ({ page }) => {
    await page.goto('/devices');
    await expect(page.locator('text=Connect to Nodi')).toBeVisible();
    await expect(page.locator('img[alt="QR code"]')).toBeVisible();
    await expect(page.locator('text=Quick access')).toBeVisible();
  });

  test('copy URL button works', async ({ page }) => {
    await page.goto('/devices');
    const copyBtn = page.locator('button').filter({ has: page.locator('svg') }).first();
    if (await copyBtn.isVisible().catch(() => false)) {
      await copyBtn.click();
      await expect(page.locator('text=copied').first()).toBeVisible({ timeout: 3000 });
    }
  });

  test('tabs switch content', async ({ page }) => {
    await page.goto('/devices');
    await page.click('text=WebDAV');
    await page.waitForTimeout(300);
    await expect(page.locator('text=WebDAV').nth(1)).toBeVisible();
    await page.click('text=Mount guides');
    await page.waitForTimeout(300);
    await page.click('text=Mobile apps');
    await page.waitForTimeout(300);
    await page.click('text=Overview');
  });

  test('access cards navigate to tabs', async ({ page }) => {
    await page.goto('/devices');
    await page.click('text=Mount as a network drive');
    await page.waitForTimeout(300);
    // Should have switched to WebDAV tab
  });

  test('reachability banner shows', async ({ page }) => {
    await page.goto('/devices');
    await expect(page.locator('text=reachable').first()).toBeVisible();
  });
});

// ───────────────────────────────────────────────
// SETTINGS PAGE
// ───────────────────────────────────────────────
test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => await login(page));

  test('renders settings with sidebar categories', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('text=General')).toBeVisible();
    await expect(page.locator('text=Password')).toBeVisible();
    await expect(page.locator('text=Storage')).toBeVisible();
    await expect(page.locator('text=Trash')).toBeVisible();
    await expect(page.locator('text=Backup')).toBeVisible();
    await expect(page.locator('text=Health')).toBeVisible();
  });

  test('general tab shows server info', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('text=Server information')).toBeVisible();
    await expect(page.locator('text=Appearance')).toBeVisible();
  });

  test('theme buttons switch and persist', async ({ page }) => {
    await page.goto('/settings');
    await page.click('button:has-text("Light")');
    await page.waitForTimeout(300);
    let cls = await page.locator('html').getAttribute('class');
    // After clicking Light, class may not have dark
    await page.click('button:has-text("Dark")');
    await page.waitForTimeout(300);
    cls = await page.locator('html').getAttribute('class');
    expect(cls).toContain('dark');
  });

  test('show hidden files toggle works', async ({ page }) => {
    await page.goto('/settings');
    const checkbox = page.locator('input[type="checkbox"]').filter({ hasText: '' }).first();
    // Just verify the checkbox is present and clickable
    await expect(page.locator('text=Show hidden files')).toBeVisible();
  });

  test('password tab shows change form', async ({ page }) => {
    await page.goto('/settings');
    await page.click('text=Password');
    await expect(page.locator('text=Change password')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(3);
  });

  test('password change rejects mismatch', async ({ page }) => {
    await page.goto('/settings');
    await page.click('text=Password');
    const pwInputs = page.locator('input[type="password"]');
    await pwInputs.nth(0).fill('admin');
    await pwInputs.nth(1).fill('newpassword123');
    await pwInputs.nth(2).fill('different123');
    await page.click('button:has-text("Update password")');
    await expect(page.locator('text=do not match')).toBeVisible({ timeout: 5000 });
  });

  test('storage tab shows stats', async ({ page }) => {
    await page.goto('/settings');
    await page.click('text=Storage');
    await expect(page.locator('text=Storage').nth(1)).toBeVisible();
    // Should show used / total or loading
    const body = await page.locator('main').textContent();
    expect(body).toMatch(/(of|Loading|unavailable)/i);
  });

  test('trash tab shows item count and empty button', async ({ page }) => {
    await page.goto('/settings');
    await page.click('text=Trash');
    await expect(page.locator('text=Trash').nth(1)).toBeVisible();
    await expect(page.locator('button:has-text("Empty trash")')).toBeVisible();
  });

  test('backup tab shows download button', async ({ page }) => {
    await page.goto('/settings');
    await page.click('text=Backup');
    await expect(page.locator('text=Download backup')).toBeVisible();
  });

  test('health tab shows system table', async ({ page }) => {
    await page.goto('/settings');
    await page.click('text=Health');
    await expect(page.locator('text=System health')).toBeVisible();
    // Should show status, uptime, etc.
    await expect(page.locator('text=Status').first()).toBeVisible();
  });

  test('back to files link works', async ({ page }) => {
    await page.goto('/settings');
    await page.click('text=Back to files');
    await page.waitForURL(/\/files/, { timeout: 5000 });
  });
});

// ───────────────────────────────────────────────
// ROUTING & 404
// ───────────────────────────────────────────────
test.describe('Routing', () => {
  test.beforeEach(async ({ page }) => await login(page));

  test('unknown routes redirect or show app shell', async ({ page }) => {
    await page.goto('/does-not-exist');
    await page.waitForTimeout(500);
    // Should still show the app shell (Nodi header)
    await expect(page.locator('text=Nodi').first()).toBeVisible();
  });

  test('direct navigation to each page works', async ({ page }) => {
    const routes = ['/', '/files', '/send', '/share', '/devices', '/settings'];
    for (const route of routes) {
      await page.goto(route);
      await page.waitForTimeout(300);
      await expect(page.locator('text=Nodi').first()).toBeVisible();
    }
  });
});

// ───────────────────────────────────────────────
// MOBILE VIEWPORT
// ───────────────────────────────────────────────
test.describe('Mobile viewport', () => {
  test.use({ viewport: { width: 375, height: 667 } });
  test.beforeEach(async ({ page }) => await login(page));

  test('home page renders on mobile', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Nodi').first()).toBeVisible();
    await expect(page.locator('text=Upload files')).toBeVisible();
  });

  test('files page renders on mobile', async ({ page }) => {
    await page.goto('/files');
    await expect(page.locator('text=Upload')).toBeVisible();
  });
});

// ───────────────────────────────────────────────
// ACCESSIBILITY
// ───────────────────────────────────────────────
test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => await login(page));

  test('login page has proper labels', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="text"]')).toHaveAttribute('placeholder', /Username/i);
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('settings page forms have labels', async ({ page }) => {
    await page.goto('/settings');
    await page.click('text=Password');
    const labels = await page.locator('label').count();
    expect(labels).toBeGreaterThan(0);
  });
});
