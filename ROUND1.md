# Round 1 — Brand, Sidebar Removal, Responsive Pass

**Goal:** Production-ready visual identity. New logo across the app. Sidebar removed entirely. Layout reflows. Sort/order bug verified.

**Estimated effort:** ~1.5 hours of straight implementation.

**Stack reminders:** Preact + TypeScript + Tailwind. Backend Go. Frontend lives in `web/app/`. Build output goes to `web/static/dist/`.

---

## Pre-flight

Run these once at the start:

```bash
cd /home/twarga/Nodi
git status   # make sure you start from a clean working tree (or stashed)
ls web/app/node_modules >/dev/null 2>&1 || (cd web/app && npm ci)
```

If `git status` shows uncommitted changes that aren't yours, **stop and ask**. Otherwise continue.

---

## Step 1 — New Logo (Brand Mark)

The current logo is a generic "folder" SVG copied in three places. Replace it with a custom hexagonal "N" mark in cyan→blue gradient.

### 1a. Create the brand mark component

**File (new):** `web/app/src/components/Logo.tsx`

```tsx
import type { JSX } from 'preact';

interface LogoProps extends JSX.SVGAttributes<SVGSVGElement> {
  size?: number;
}

/**
 * Nodi brand mark — hexagonal "N" with cyan→blue gradient.
 * Pass `size` (px) or override via class. The gradient id is unique per mount
 * so multiple Logos on one page do not collide.
 */
export function Logo({ size = 24, class: className, ...rest }: LogoProps) {
  // Stable per-instance gradient id — useId would also work but we avoid the import
  const gid = `nodi-grad-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      class={className}
      {...rest}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#06b6d4" />
          <stop offset="100%" stop-color="#2563eb" />
        </linearGradient>
      </defs>
      {/* Hexagon body */}
      <path
        d="M16 2.5L27.5 9v14L16 29.5 4.5 23V9L16 2.5z"
        fill={`url(#${gid})`}
      />
      {/* Stylized "N" stroke */}
      <path
        d="M11 21V11l10 10V11"
        stroke="white"
        stroke-width="2.4"
        stroke-linecap="round"
        stroke-linejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function Wordmark({ class: className }: { class?: string }) {
  return (
    <span class={['flex items-center gap-2', className].filter(Boolean).join(' ')}>
      <Logo size={28} />
      <span class="text-base font-bold tracking-tight">Nodi</span>
    </span>
  );
}
```

### 1b. Use Logo in TopBar

**File:** `web/app/src/components/TopBar.tsx`

Replace the entire `NodiBrand` function (currently lines 6–17) with:

```tsx
import { Logo } from './Logo';

function NodiBrand() {
  return (
    <div class="flex items-center gap-2.5">
      <Logo size={32} class="drop-shadow-sm" />
      <span class="text-base font-bold tracking-tight hidden sm:block">Nodi</span>
    </div>
  );
}
```

(Add `import { Logo } from './Logo';` at the top of the file with the other imports.)

### 1c. Use Logo in Login page

**File:** `web/app/src/pages/Login.tsx`

Replace the entire `{/* Brand */}` block (currently lines 27–37) with:

```tsx
{/* Brand */}
<div class="mb-8 flex flex-col items-center gap-3">
  <Logo size={56} class="drop-shadow-md" />
  <div class="text-center">
    <h1 class="text-xl font-bold tracking-tight text-foreground">Nodi</h1>
    <p class="mt-1 text-sm text-muted-foreground">Sign in to continue</p>
  </div>
</div>
```

Add at the top of the file: `import { Logo } from '../components/Logo';`

### 1d. Replace favicon

**File:** `web/app/index.html`

Find the `<link rel="icon" ...>` line in `<head>` and replace with:

```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
```

**File (new):** `web/app/public/favicon.svg`

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#06b6d4"/>
      <stop offset="100%" stop-color="#2563eb"/>
    </linearGradient>
  </defs>
  <path d="M16 2.5L27.5 9v14L16 29.5 4.5 23V9L16 2.5z" fill="url(#g)"/>
  <path d="M11 21V11l10 10V11" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>
```

(If `web/app/public/` doesn't exist, create it with `mkdir -p web/app/public`.)

If there is an existing `web/static/favicon.svg` or `web/static/logo.png`, also overwrite `web/static/favicon.svg` with the same SVG so the Go server's static fallback works. Leave `logo.png` alone for now.

---

## Step 2 — Remove the Sidebar Entirely

The user explicitly said the sidebar is useless. Delete it everywhere.

### 2a. Delete the Sidebar component file

```bash
rm web/app/src/components/Sidebar.tsx
```

### 2b. Remove Sidebar usage from Dashboard

**File:** `web/app/src/pages/Dashboard.tsx`

1. Delete the line `import { Sidebar } from '../components/Sidebar';` (around line 5).
2. Find this block (currently around lines 250–252):
   ```tsx
   <div class="flex flex-1 overflow-hidden relative z-0">
     <Sidebar />
     <main class="flex-1 overflow-y-auto overflow-x-hidden relative z-0">
   ```
   Replace with:
   ```tsx
   <div class="flex flex-1 overflow-hidden relative z-0">
     <main class="flex-1 overflow-y-auto overflow-x-hidden relative z-0">
   ```

### 2c. Remove sidebar state from app store

**File:** `web/app/src/stores/app.ts`

1. In the `AppState` interface, **delete** the line: `sidebarOpen: boolean;`
2. In the `appState` initial value, **delete** the line: `sidebarOpen: false,`
3. **Delete** the entire `toggleSidebar` function at the bottom of the file (lines 89–91 ish).

### 2d. Remove sidebar toggle from TopBar

**File:** `web/app/src/components/TopBar.tsx`

1. Delete the import: `import { toggleSidebar } from '../stores/app';`
2. Delete the entire `{/* Mobile hamburger */}` block including the `<button onClick={toggleSidebar} ...>...</button>` (currently lines 68–77).
3. The header now just contains `<NodiBrand />` on the left.

### 2e. grep for any other sidebar references

```bash
grep -rn "sidebarOpen\|toggleSidebar\|Sidebar" web/app/src/
```

Expected: zero matches (other than `web/app/src/components/Logo.tsx`, which doesn't have any). If any matches remain, fix them — usually they'll be more imports or `class="lg:..."` reservations. Just delete the references; do not rewrite the surrounding logic.

---

## Step 3 — Reclaim the Sidebar Space (Layout Adjust)

Now that the sidebar is gone, the main area should fill the screen. The current Dashboard already wraps `<main>` content in `mx-auto max-w-7xl`, which is correct — it will now center properly.

**File:** `web/app/src/pages/Dashboard.tsx`

In the JSX root `<div class="flex h-screen flex-col overflow-hidden bg-background">`, the inner wrapper should become:

Find: `<div class="px-6 pt-6 pb-8 mx-auto max-w-7xl">`
Replace with: `<div class="px-4 sm:px-6 lg:px-8 pt-6 pb-8 mx-auto max-w-screen-2xl">`

This widens the content cap (was 7xl=80rem, now 2xl=96rem) and tightens horizontal padding on mobile (16px) → tablet (24px) → desktop (32px).

---

## Step 4 — Verify the Sort/Order Bug

The user reported "I can't order or set objects inside a folder." Verify this is fixed/works.

### 4a. Confirm sort/order are reactive on path changes

**File:** `web/app/src/pages/Dashboard.tsx` — already correct at line 87:
```ts
useEffect(() => { loadFiles(state.currentPath); },
  [state.currentPath, state.sortBy, state.sortOrder, state.showHidden]);
```

The dep array already includes `sortBy` and `sortOrder`, so changing sort *does* refetch. **Don't change this.**

### 4b. Confirm backend respects `sort` and `order` in subfolders

Read `internal/handlers/files.go` — find the `Browse` function (around line 252). Look for these two lines (search for the strings):

```go
sort := r.URL.Query().Get("sort")
order := r.URL.Query().Get("order")
```

If both are read from the query string and applied unconditionally (not gated on `subPath == ""`), the backend is fine.

If the bug is real and sort doesn't apply in subfolders, look for any branch like `if subPath == "" {...}` that wraps the sort logic — flatten it so sort applies regardless. Otherwise leave the file alone.

### 4c. Manual smoke test

After build, in browser:

1. Navigate into any subfolder.
2. Switch sort to "Size" → list should reorder.
3. Toggle asc/desc → list should reverse.
4. Switch sort to "Modified" → list should reorder by date.

If any of these fail, the bug is real and the fix is in `files.go`. Most likely it already works.

---

## Step 5 — Build and Verify

```bash
cd /home/twarga/Nodi/web/app
npm run build
```

Expected: build succeeds, output in `../static/dist/`. If TypeScript errors, fix them — they'll all be from removed `sidebarOpen` references.

```bash
cd /home/twarga/Nodi
go build ./...
```

Expected: succeeds. Backend wasn't touched in Round 1.

### Smoke test (manual, in browser)

```bash
cd /home/twarga/Nodi
./run.sh
```

Then open http://localhost:7319 and verify:

- [ ] Login page shows new hexagonal "N" logo, not generic folder.
- [ ] After login, TopBar shows new hexagonal "N" logo.
- [ ] **No sidebar** on the left. Content uses full width up to 96rem.
- [ ] Browser tab favicon is the hex "N" logo.
- [ ] Mobile width (resize to ~400px): no hamburger button. Layout reflows.
- [ ] Inside a subfolder, changing sort dropdown reorders files.
- [ ] Inside a subfolder, asc/desc toggle works.

---

## Done

If all checkboxes pass, commit:

```bash
cd /home/twarga/Nodi
git add -A
git commit -m "Round 1: New brand mark, remove sidebar, responsive pass"
```

Then proceed to `ROUND2.md`.
