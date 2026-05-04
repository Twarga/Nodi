import { setPath, setFiles, setLoading, currentPath, breadcrumbs } from '../stores/app';
import { browseAPI } from '../lib/api';

function buildBreadcrumbs(path: string): { name: string; path: string }[] {
  if (!path || path === '/') return [];
  const parts = path.replace(/^\//, '').split('/');
  const segments: { name: string; path: string }[] = [];
  let current = '';
  for (const part of parts) {
    if (!part) continue;
    current += '/' + part;
    segments.push({ name: part, path: current });
  }
  return segments;
}

function ChevronRightIcon() {
  return (
    <svg class="h-3.5 w-3.5 text-muted-foreground/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  );
}

export function Breadcrumbs() {
  const bc = breadcrumbs.value;
  const cp = currentPath.value;

  const navigateTo = async (path: string) => {
    setLoading(true);
    try {
      const data = await browseAPI.list({ path });
      setPath(path, buildBreadcrumbs(path));
      setFiles(data.files || []);
    } catch {
      setFiles([]);
    }
  };

  return (
    <nav class="flex items-center gap-1.5 text-sm overflow-x-auto no-scrollbar" aria-label="Breadcrumb">
      <button
        onClick={() => navigateTo('')}
        class={[
          'flex items-center gap-1.5 rounded-lg px-2 py-1 whitespace-nowrap transition-all duration-200 hover:bg-surface-hover/80 hover:text-foreground hover:shadow-sm',
          cp === '' ? 'text-primary font-semibold' : 'text-muted-foreground',
        ].join(' ')}
        title="Home"
      >
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        <span class="hidden sm:inline">Home</span>
      </button>

      {bc.map((segment, i) => {
        const isLast = i === bc.length - 1;
        return (
          <span key={segment.path} class="flex items-center gap-1.5">
            <ChevronRightIcon />
            <button
              onClick={() => navigateTo(segment.path)}
              class={[
                'rounded-lg px-2 py-1 whitespace-nowrap transition-all duration-200 hover:bg-surface-hover/80 hover:text-foreground hover:shadow-sm truncate max-w-[140px] sm:max-w-[220px]',
                isLast ? 'text-foreground font-semibold' : 'text-muted-foreground',
              ].join(' ')}
              title={segment.name}
            >
              {segment.name}
            </button>
          </span>
        );
      })}
    </nav>
  );
}
