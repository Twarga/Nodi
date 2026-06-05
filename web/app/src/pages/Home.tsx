import { useState, useEffect } from 'preact/hooks';
import { useAuth } from '../stores/auth';
import { navigate } from '../lib/router';
import { Logo } from '../components/Logo';
import { ToastContainer, toast } from '../hooks/useToast';

function GitHubIcon({ class: cls }: { class?: string }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.235-.015-2.25-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
    </svg>
  );
}

function StarIcon({ class: cls }: { class?: string }) {
  return <svg class={cls} viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>;
}

function CopyIcon({ class: cls }: { class?: string }) {
  return <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;
}

function CheckIcon({ class: cls }: { class?: string }) {
  return <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>;
}

function LockIcon({ class: cls }: { class?: string }) {
  return <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
}

function ZapIcon({ class: cls }: { class?: string }) {
  return <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10"/></svg>;
}

function MonitorIcon({ class: cls }: { class?: string }) {
  return <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>;
}

function ShareNodesIcon({ class: cls }: { class?: string }) {
  return <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>;
}

function CodeIcon({ class: cls }: { class?: string }) {
  return <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>;
}

function ChevronLeftIcon({ class: cls }: { class?: string }) {
  return <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><polyline points="15 18 9 12 15 6"/></svg>;
}

function ChevronRightIcon({ class: cls }: { class?: string }) {
  return <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><polyline points="9 18 15 12 9 6"/></svg>;
}

function ServerIcon({ class: cls }: { class?: string }) {
  return <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>;
}

function MemoryIcon({ class: cls }: { class?: string }) {
  return <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}

function DockerIcon({ class: cls }: { class?: string }) {
  return <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M22 13c0-3.7-2.6-7-6-7H8c-3.4 0-6 3.3-6 7v6h20v-6z"/><line x1="6" y1="13" x2="18" y2="13"/><line x1="10" y1="13" x2="10" y2="6"/><line x1="14" y1="13" x2="14" y2="6"/></svg>;
}

export function HomePage() {
  const { state } = useAuth();
  const isAuth = !!state.value.user;
  const [stars, setStars] = useState<string>('1.2k');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('https://api.github.com/repos/Twarga/Nodi')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.stargazers_count) {
          const n = data.stargazers_count;
          setStars(n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n));
        }
      })
      .catch(() => {});
  }, []);

  const copyInstall = async () => {
    try {
      await navigator.clipboard.writeText('curl -fsSL https://get.nodi.sh | bash');
      setCopied(true);
      toast('Copied to clipboard', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div class="min-h-screen bg-background text-foreground">
      {/* ── Nav ── */}
      <header class="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-sm">
        <div class="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:px-8">
          <div class="flex items-center gap-8">
            <button onClick={() => scrollTo('hero')} class="flex items-center gap-2 border-none bg-transparent cursor-pointer">
              <Logo size={28} class="text-primary" />
              <span class="text-base font-bold tracking-tight">Nodi</span>
              <span class="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-medium text-foreground-muted">v0.1.0</span>
            </button>
            <nav class="hidden items-center gap-6 md:flex">
              {[
                { label: 'Features', id: 'features' },
                { label: 'Screenshots', id: 'screenshots' },
                { label: 'Docs', id: 'install' },
                { label: 'FAQ', id: 'faq' },
                { label: 'Changelog', id: 'changelog' },
              ].map(l => (
                <button
                  key={l.id}
                  onClick={() => scrollTo(l.id)}
                  class="text-sm font-medium text-foreground-muted transition-colors hover:text-foreground border-none bg-transparent cursor-pointer"
                >
                  {l.label}
                </button>
              ))}
            </nav>
          </div>
          <div class="flex items-center gap-3">
            <a
              href="https://github.com/Twarga/Nodi"
              target="_blank"
              rel="noopener noreferrer"
              class="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground-muted transition-colors hover:border-border-strong hover:text-foreground"
            >
              <StarIcon class="h-3.5 w-3.5" />
              Star {stars}
            </a>
            <button
              onClick={() => navigate(isAuth ? '/files' : '/login')}
              class="btn btn-primary h-8 px-4 text-xs"
            >
              {isAuth ? 'Open Nodi' : 'Get Started'}
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section id="hero" class="relative overflow-hidden">
        {/* Subtle glow */}
        <div class="pointer-events-none absolute inset-0" style={{
          background: 'radial-gradient(ellipse 60% 50% at 70% 40%, rgba(20,184,166,0.06) 0%, transparent 70%), radial-gradient(ellipse 50% 40% at 20% 60%, rgba(20,184,166,0.04) 0%, transparent 60%)'
        }} />

        <div class="relative mx-auto max-w-6xl px-5 sm:px-8 pt-16 pb-20">
          <div class="grid gap-12 lg:grid-cols-2 lg:items-center">
            {/* Left: Copy */}
            <div>
              {/* Badge */}
              <div class="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-foreground-muted">
                <span class="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                <span>Self-hosted</span>
                <span class="text-border-strong">•</span>
                <span>Private</span>
                <span class="text-border-strong">•</span>
                <span>Fast</span>
              </div>

              {/* Headline */}
              <h1 class="mt-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-[3.5rem] lg:leading-[1.1]">
                <span class="text-foreground">Your files.</span>
                <br />
                <span class="text-primary">On your network.</span>
              </h1>

              <p class="mt-5 max-w-md text-base leading-relaxed text-foreground-muted">
                Nodi is a self-hosted file hub for your home. Access, upload and share your files from any device on your local network.
              </p>

              {/* CTAs */}
              <div class="mt-8 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => navigate(isAuth ? '/files' : '/login')}
                  class="btn btn-primary h-10 px-5 text-sm"
                >
                  <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  {isAuth ? 'Open Nodi' : 'Get Started'}
                </button>
                <a
                  href="https://github.com/Twarga/Nodi"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="btn btn-outline h-10 px-5 text-sm gap-2"
                >
                  <GitHubIcon class="h-4 w-4" />
                  View on GitHub
                </a>
              </div>

              {/* Install command */}
              <div class="mt-8">
                <div class="inline-flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 font-mono text-sm">
                  <span class="text-foreground-subtle">$</span>
                  <span class="text-foreground">curl -fsSL https://get.nodi.sh | bash</span>
                  <button
                    onClick={copyInstall}
                    class="icon-button h-7 w-7"
                    title="Copy command"
                    aria-label="Copy install command"
                  >
                    {copied ? (
                      <svg class="h-3.5 w-3.5 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    ) : (
                      <CopyIcon class="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
                <p class="mt-2 text-xs text-foreground-subtle">One command. That's it.</p>
              </div>
            </div>

            {/* Right: App mockup */}
            <div class="relative hidden lg:block">
              <AppMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" class="border-t border-border bg-surface-sunken/50">
        <div class="mx-auto max-w-6xl px-5 sm:px-8 py-14">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold tracking-tight text-foreground">Features</h2>
            <div class="flex items-center gap-2">
              <button class="icon-button h-7 w-7" aria-label="Previous feature"><ChevronLeftIcon class="h-3.5 w-3.5" /></button>
              <button class="icon-button h-7 w-7" aria-label="Next feature"><ChevronRightIcon class="h-3.5 w-3.5" /></button>
            </div>
          </div>

          <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { icon: LockIcon, title: '100% Private', desc: 'Your data never leaves your network.' },
              { icon: ZapIcon, title: 'Lightning Fast', desc: 'Zero latency access. No cloud, just local.' },
              { icon: MonitorIcon, title: 'Use Everywhere', desc: 'Web, mobile, desktop. Works on any device.' },
              { icon: ShareNodesIcon, title: 'Share Easily', desc: 'Create secure links and upload dropboxes.' },
              { icon: CodeIcon, title: 'Open Source', desc: 'Free, open source and community driven.' },
            ].map(f => (
              <div key={f.title} class="rounded-xl border border-border bg-card p-5 transition-colors hover:border-border-strong">
                <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <f.icon class="h-5 w-5" />
                </div>
                <h3 class="mt-4 text-sm font-semibold text-foreground">{f.title}</h3>
                <p class="mt-1.5 text-xs leading-relaxed text-foreground-muted">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why Nodi / Install ── */}
      <section id="install" class="border-t border-border">
        <div class="mx-auto max-w-6xl px-5 sm:px-8 py-16">
          <div class="grid gap-10 lg:grid-cols-3">
            {/* Left: Why Nodi */}
            <div>
              <h3 class="text-sm font-semibold uppercase tracking-wider text-foreground-subtle">Why Nodi?</h3>
              <ul class="mt-6 space-y-4">
                {[
                  'Built for homes and small teams',
                  'No accounts, no tracking, no ads',
                  'Lightweight and easy to run',
                  'Actively developed',
                ].map(item => (
                  <li key={item} class="flex items-start gap-3 text-sm text-foreground-muted">
                    <span class="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                      <CheckIcon class="h-2.5 w-2.5" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Center: Install */}
            <div class="lg:text-center">
              <h2 class="text-2xl font-bold tracking-tight text-foreground">Get Nodi running in seconds</h2>
              <p class="mt-2 text-sm text-foreground-muted">One command installer for Linux, macOS and more.</p>

              <div class="mt-6 inline-flex w-full max-w-md items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 font-mono text-sm sm:text-base">
                <span class="text-primary">$</span>
                <span class="flex-1 truncate text-foreground">curl -fsSL https://get.nodi.sh | bash</span>
                <button
                  onClick={copyInstall}
                  class="icon-button h-8 w-8 shrink-0"
                  title="Copy command"
                  aria-label="Copy install command"
                >
                  {copied ? (
                    <svg class="h-4 w-4 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  ) : (
                    <CopyIcon class="h-4 w-4" />
                  )}
                </button>
              </div>

              <p class="mt-4 text-sm text-foreground-muted">
                Or install manually from{' '}
                <a href="https://github.com/Twarga/Nodi#readme" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">our docs</a>.
              </p>
            </div>

            {/* Right: System Requirements */}
            <div>
              <h3 class="text-sm font-semibold uppercase tracking-wider text-foreground-subtle">System Requirements</h3>
              <ul class="mt-6 space-y-4">
                {[
                  { icon: MemoryIcon, text: '1 GB RAM minimum' },
                  { icon: ServerIcon, text: 'Any modern Linux / macOS' },
                  { icon: DockerIcon, text: 'Docker (recommended)' },
                ].map(req => (
                  <li key={req.text} class="flex items-center gap-3 text-sm text-foreground-muted">
                    <req.icon class="h-4 w-4 shrink-0 text-foreground-subtle" />
                    {req.text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer class="border-t border-border py-8">
        <div class="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 sm:flex-row sm:px-8">
          <div class="flex items-center gap-2 text-xs text-foreground-subtle">
            <Logo size={16} class="text-primary" />
            <span class="font-semibold text-foreground">Nodi</span>
            <span>v0.1.0</span>
          </div>
          <div class="flex items-center gap-4 text-xs text-foreground-subtle">
            <a href="https://github.com/Twarga/Nodi" target="_blank" rel="noopener noreferrer" class="hover:text-foreground transition-colors">GitHub</a>
            <a href="#" class="hover:text-foreground transition-colors">Docs</a>
            <a href="#" class="hover:text-foreground transition-colors">FAQ</a>
          </div>
          <p class="text-xs text-foreground-subtle">
            Built with <span class="text-primary">♥</span> for your network.
          </p>
        </div>
      </footer>

      <ToastContainer />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   APP MOCKUP — CSS-only Nodi UI preview
   ═══════════════════════════════════════════════════════════ */

function AppMockup() {
  const folders = ['Assets', 'Components', 'Screens'];
  const files = [
    { name: 'Nodi Design System.fig', size: '45.6 MB', date: 'May 21, 2024 at 14:32', icon: 'fig' },
    { name: 'Cover.png', size: '2.4 MB', date: 'May 20, 2024 at 11:09', icon: 'img' },
    { name: 'Roadmap.md', size: '12 kB', date: 'May 19, 2024 at 09:15', icon: 'doc' },
  ];

  return (
    <div
      class="relative overflow-hidden rounded-xl border border-border bg-card"
      style={{
        boxShadow: '0 0 0 1px rgba(20,184,166,0.1), 0 24px 64px rgba(0,0,0,0.4), 0 0 80px rgba(20,184,166,0.06)',
      }}
    >
      {/* Window chrome */}
      <div class="flex items-center gap-2 border-b border-border px-4 py-3">
        <Logo size={20} class="text-primary" />
        <span class="text-sm font-semibold">Nodi</span>
        <div class="ml-auto flex items-center gap-2">
          <div class="hidden rounded-md border border-border bg-surface px-2.5 py-1 text-[10px] text-foreground-subtle sm:flex items-center gap-1.5">
            <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            Search files…
            <span class="rounded border border-border bg-card px-1 py-0 text-[9px]">Ctrl K</span>
          </div>
          <div class="h-6 w-6 rounded-full bg-primary text-[10px] font-semibold text-primary-foreground flex items-center justify-center">Y</div>
        </div>
      </div>

      <div class="flex">
        {/* Sidebar */}
        <div class="hidden w-44 shrink-0 border-r border-border py-3 sm:block">
          {[
            { label: 'Files', active: true },
            { label: 'Send', active: false },
            { label: 'Shares', active: false },
            { label: 'Devices', active: false },
            { label: 'Settings', active: false },
          ].map(item => (
            <div
              key={item.label}
              class={[
                'mx-2 flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs',
                item.active ? 'bg-primary-soft text-primary font-medium' : 'text-foreground-muted',
              ].join(' ')}
            >
              <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                {item.label === 'Files' && <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>}
                {item.label === 'Send' && <g><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></g>}
                {item.label === 'Shares' && <g><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></g>}
                {item.label === 'Devices' && <g><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></g>}
                {item.label === 'Settings' && <g><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.67 15 1.65 1.65 0 0 0 3 13.51V13a2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 6.6 9.09a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H12a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V12a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></g>}
              </svg>
              {item.label}
            </div>
          ))}
          <div class="mx-3 mt-4 rounded-lg border border-border p-3">
            <p class="text-[10px] font-medium text-foreground-subtle">Storage</p>
            <div class="mt-2 flex items-baseline justify-between">
              <span class="text-xs font-semibold text-foreground">46%</span>
            </div>
            <div class="mt-1.5 h-1 w-full rounded-full bg-surface">
              <div class="h-full w-[46%] rounded-full bg-primary" />
            </div>
            <p class="mt-1 text-[10px] text-foreground-subtle">487 GB / 1 TB</p>
          </div>
        </div>

        {/* Main area */}
        <div class="flex-1 overflow-hidden p-4">
          {/* Breadcrumbs */}
          <div class="flex items-center gap-1 text-[10px] text-foreground-subtle">
            <span>Files</span>
            <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><polyline points="9 18 15 12 9 6"/></svg>
            <span>Projects</span>
            <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><polyline points="9 18 15 12 9 6"/></svg>
            <span>Nodi</span>
            <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><polyline points="9 18 15 12 9 6"/></svg>
            <span class="font-medium text-foreground">Design</span>
          </div>

          {/* Header */}
          <div class="mt-3 flex items-center justify-between">
            <div>
              <h2 class="text-base font-semibold text-foreground">Design</h2>
              <p class="text-[10px] text-foreground-muted">12 items</p>
            </div>
            <div class="flex items-center gap-2">
              <span class="rounded-md border border-border bg-surface px-2 py-1 text-[10px] text-foreground-muted flex items-center gap-1">
                <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Upload
              </span>
              <span class="rounded-md border border-border bg-surface px-2 py-1 text-[10px] text-foreground-muted flex items-center gap-1">
                <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
                New folder
              </span>
            </div>
          </div>

          {/* File list header */}
          <div class="mt-3 grid grid-cols-[1fr_60px_100px] items-center border-b border-border px-2 py-1.5 text-[10px] font-medium text-foreground-subtle">
            <span>Name</span>
            <span class="text-right">Size</span>
            <span class="text-right">Modified</span>
          </div>

          {/* Folder rows */}
          {folders.map(name => (
            <div key={name} class="grid grid-cols-[1fr_60px_100px] items-center border-b border-border px-2 py-2 text-[11px]">
              <div class="flex items-center gap-2">
                <svg class="h-4 w-4 text-icon-folder" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                <span class="text-foreground">{name}</span>
              </div>
              <span class="text-right text-foreground-subtle">—</span>
              <span class="text-right text-[10px] text-foreground-muted">May 23, 2024 at 18:42</span>
            </div>
          ))}

          {/* File rows */}
          {files.map(file => (
            <div key={file.name} class="grid grid-cols-[1fr_60px_100px] items-center border-b border-border px-2 py-2 text-[11px]">
              <div class="flex items-center gap-2">
                {file.icon === 'fig' && <span class="text-lg leading-none">🎨</span>}
                {file.icon === 'img' && <svg class="h-4 w-4 text-icon-image" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="1"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>}
                {file.icon === 'doc' && <svg class="h-4 w-4 text-icon-generic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
                <span class="text-foreground">{file.name}</span>
              </div>
              <span class="text-right text-foreground-subtle">{file.size}</span>
              <span class="text-right text-[10px] text-foreground-muted">{file.date}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
