import { useEffect, useState } from 'preact/hooks';
import QRCode from 'qrcode';
import { TopBar } from '../components/TopBar';
import { ToastContainer, toast } from '../hooks/useToast';
import { devicesAPI } from '../lib/api';
import type { DevicesInfo } from '../lib/api';

function copyText(value: string, label: string) {
  if (!value) return;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(value).then(() => toast(`${label} copied`, 'success')).catch(() => toast('Copy failed', 'error'));
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
  toast(`${label} copied`, 'success');
}

type DeviceTab = 'overview' | 'webdav' | 'guides' | 'mobile';

const platformGuides = [
  { title: 'Windows', icon: <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/></svg> },
  { title: 'macOS', icon: <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.21-1.96 1.07-3.11-1.05.05-2.31.7-3.06 1.6-.67.78-1.26 2.03-1.1 3.14 1.18.09 2.38-.66 3.09-1.63"/></svg> },
  { title: 'Linux', icon: <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12 2 2 12 2z"/><path d="M12 6v6l4 2"/></svg> },
  { title: 'Android', icon: <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.523 15.341c-.5 0-.891-.383-.891-.882 0-.5.392-.882.891-.882.5 0 .891.383.891.882 0 .499-.391.882-.891.882zm-11.046 0c-.5 0-.891-.383-.891-.882 0-.5.392-.882.891-.882.5 0 .891.383.891.882 0 .499-.391.882-.891.882zm11.4-3.516l1.953-3.381a.365.365 0 0 0-.133-.499.368.368 0 0 0-.5.133l-1.977 3.425c-1.468-.666-3.115-1.047-4.869-1.047s-3.401.381-4.869 1.047L5.505 7.078a.368.368 0 0 0-.5-.133.367.367 0 0 0-.133.499l1.953 3.381C3.693 13.695 2 16.93 2 20.583h20c0-3.653-1.693-6.888-4.123-8.758z"/></svg> },
  { title: 'iPhone & iPad (iOS)', icon: <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-.06.04-2.03 1.21-2.01 3.6.02 2.87 2.49 3.82 2.51 3.83-.03.07-.39 1.37-1.27 2.69-.76 1.13-1.54 2.24-2.71 2.29-.73.03-1.22-.48-2.27-.48-1.16 0-1.53.5-2.3.48zM12.03 7.25c-.15-2.05 1.66-3.83 3.74-3.91.29 2.32-2.03 4.47-3.74 3.91z"/></svg> },
];

export function DevicesPage() {
  const [info, setInfo] = useState<DevicesInfo | null>(null);
  const [qr, setQR] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<DeviceTab>('overview');

  useEffect(() => {
    let cancelled = false;
    devicesAPI.get().then((data) => {
      if (cancelled) return;
      setInfo(data);
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setLoading(false);
      toast('Failed to load device URLs', 'error');
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!info?.recommended) return;
    QRCode.toDataURL(info.recommended, { errorCorrectionLevel: 'M', margin: 1, width: 288, color: { dark: '#0a0a0a', light: '#ffffff' } })
      .then(setQR).catch(() => setQR(''));
  }, [info?.recommended]);

  const recommended = info?.recommended || '';
  const webdavUrl = info?.addresses.find((a) => a.url === recommended)?.webdav || info?.addresses[0]?.webdav || '';

  return (
    <div class="min-h-screen bg-background">
      <TopBar />

      <main class="mx-auto max-w-5xl px-5 sm:px-8 pt-8 pb-20 sm:pb-16">
        <h1 class="text-xl font-semibold tracking-tight text-foreground">Connect to Nodi from your devices</h1>
        <p class="mt-1 text-sm text-foreground-muted">Access your files from any device on your local network.</p>

        {/* Hero with QR */}
        <div class="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div class="flex flex-col justify-center">
            <div class="p-6 border border-border rounded-xl bg-card flex items-center justify-center">
              {qr ? (
                <img src={qr} alt="QR code" class="h-48 w-48 rounded-lg" />
              ) : (
                <div class="h-48 w-48 flex items-center justify-center bg-surface rounded-lg text-sm text-foreground-subtle">
                  {loading ? 'Loading…' : 'No URL'}
                </div>
              )}
            </div>
          </div>
          <div class="flex flex-col justify-center">
            <h2 class="text-base font-semibold text-foreground">Quick access</h2>
            <p class="mt-1 text-sm text-foreground-muted">Scan the QR code or open the address below in your browser.</p>
            <div class="mt-4 flex items-center gap-2 p-3 border border-border rounded-lg bg-surface">
              <svg class="h-4 w-4 text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              <span class="text-sm text-primary truncate flex-1">{recommended || 'Unavailable'}</span>
              <button onClick={() => recommended && copyText(recommended, 'URL')} disabled={!recommended} class="btn btn-ghost h-7 px-2 text-xs shrink-0">
                <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
            </div>
            {info?.addresses[1] && (
              <p class="mt-3 text-xs text-foreground-muted">
                Also try: <span class="text-primary">{info.addresses[1].url}</span>
                <button onClick={() => copyText(info.addresses[1].url, 'URL')} class="ml-2 text-primary hover:underline border-none bg-transparent cursor-pointer text-xs">Copy</button>
              </p>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div class="mt-10 flex items-center gap-1 border-b border-border">
          {(['overview', 'webdav', 'guides', 'mobile'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              class={[
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors border-none bg-transparent cursor-pointer',
                tab === t ? 'text-primary border-b-primary' : 'text-foreground-muted border-b-transparent hover:text-foreground',
              ].join(' ')}
            >
              {t === 'overview' ? 'Overview' : t === 'webdav' ? 'WebDAV' : t === 'guides' ? 'Mount guides' : 'Mobile apps'}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div class="mt-6">
          {tab === 'overview' && (
            <div class="grid gap-4 sm:grid-cols-3">
              <AccessCard
                icon={<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>}
                title="Web interface"
                subtitle="Open in your browser"
                onClick={() => window.open(recommended, '_blank')}
              />
              <AccessCard
                icon={<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>}
                title="WebDAV"
                subtitle="Mount as a network drive"
                onClick={() => setTab('webdav')}
              />
              <AccessCard
                icon={<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>}
                title="Mobile apps"
                subtitle="Access on the go"
                onClick={() => setTab('mobile')}
              />
            </div>
          )}

          {tab === 'webdav' && (
            <div class="max-w-xl space-y-4">
              <div class="p-5 border border-border rounded-lg bg-card">
                <h3 class="text-sm font-semibold text-foreground">Mount Nodi using WebDAV</h3>
                <p class="mt-1 text-xs text-foreground-muted">Use the following settings to connect.</p>
                <div class="mt-4 space-y-3">
                  <Field label="Server URL" value={webdavUrl || '—'} onCopy={() => webdavUrl && copyText(webdavUrl, 'WebDAV URL')} />
                  <Field label="Username" value="you" />
                  <Field label="Password" value="Your Nodi login password" />
                </div>
                <p class="mt-4 text-xs text-foreground-muted">
                  Need help? <button onClick={() => setTab('guides')} class="text-primary hover:underline border-none bg-transparent cursor-pointer">View setup guides</button> for your device.
                </p>
              </div>
            </div>
          )}

          {tab === 'guides' && (
            <div class="grid gap-3">
              {platformGuides.map((guide) => (
                <button
                  key={guide.title}
                  onClick={() => webdavUrl && copyText(webdavUrl, 'WebDAV URL')}
                  class="flex items-center gap-4 p-4 border border-border rounded-lg bg-card hover:bg-surface-hover transition-colors text-left border-none bg-transparent cursor-pointer"
                >
                  <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface text-foreground">{guide.icon}</span>
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-medium text-foreground">{guide.title}</p>
                    <p class="text-xs text-foreground-muted mt-0.5">Setup guide available</p>
                  </div>
                  <svg class="h-5 w-5 text-foreground-subtle shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              ))}
            </div>
          )}

          {tab === 'mobile' && (
            <div class="max-w-xl p-5 border border-border rounded-lg bg-card">
              <h3 class="text-sm font-semibold text-foreground">Mobile access</h3>
              <p class="mt-2 text-sm text-foreground-muted leading-relaxed">
                Connect to the same Wi-Fi, scan the QR code above, sign in, then use Send for camera, gallery, and file uploads.
              </p>
              <p class="mt-4 text-sm text-foreground-muted leading-relaxed">
                For the best experience, add Nodi to your home screen. In Safari, tap the Share button and choose &quot;Add to Home Screen&quot;.
              </p>
            </div>
          )}
        </div>

        {/* Reachability banner */}
        <div class="mt-10 flex items-center justify-between p-4 border border-border rounded-lg bg-card">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary">
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
            </div>
            <div>
              <p class="text-sm font-medium text-foreground">Nodi is reachable</p>
              <p class="text-xs text-foreground-muted">Your server is online and reachable on your local network.</p>
            </div>
          </div>
          <button onClick={() => {
            setLoading(true);
            devicesAPI.get().then((data) => { setInfo(data); setLoading(false); }).catch(() => { setLoading(false); toast('Failed to refresh', 'error'); });
          }} class="btn btn-outline h-9 px-3 text-xs">
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            Check again
          </button>
        </div>
      </main>

      <ToastContainer />
    </div>
  );
}

function AccessCard({ icon, title, subtitle, onClick }: { icon: preact.ComponentChildren; title: string; subtitle: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      class="flex items-center gap-4 p-4 border border-border rounded-lg bg-card hover:bg-surface-hover transition-colors text-left w-full border-none bg-transparent cursor-pointer"
    >
      <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface text-primary">{icon}</span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-foreground">{title}</p>
        <p class="text-xs text-foreground-muted mt-0.5">{subtitle}</p>
      </div>
      <svg class="h-5 w-5 text-foreground-subtle shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><polyline points="9 18 15 12 9 6"/></svg>
    </button>
  );
}

function Field({ label, value, onCopy, isPassword }: { label: string; value: string; onCopy?: () => void; isPassword?: boolean }) {
  return (
    <div>
      <label class="text-xs font-medium text-foreground-subtle block mb-1.5">{label}</label>
      <div class="flex items-center gap-2">
        <div class="flex-1 p-2.5 border border-border rounded-lg bg-surface">
          <span class={['text-sm', isPassword ? 'text-foreground' : 'text-primary'].join(' ')}>{value}</span>
        </div>
        {onCopy && (
          <button onClick={onCopy} class="btn btn-outline h-9 px-3 text-xs shrink-0">
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
        )}
      </div>
    </div>
  );
}
