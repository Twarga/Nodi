import { appState } from '../stores/app';
import { browseAPI } from '../lib/api';
import { setPath } from '../stores/app';

function ChevronRightIcon({ class: cls }: { class?: string }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  );
}

function HomeIcon({ class: cls }: { class?: string }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}

export function Breadcrumbs() {
  const { breadcrumbs, currentPath } = appState.value;

  const navigateTo = async (path: string) => {
    const data = await browseAPI.list({ path });
    setPath(path, data.path);
  };

  return (
    <nav class="flex items-center gap-1 text-sm text-muted-foreground">
      <button
        onClick={() => navigateTo('')}
        class={[
          'flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors hover:bg-surface-hover hover:text-foreground',
          currentPath === '' ? 'text-primary font-medium' : '',
        ].join(' ')}
        title="Home"
      >
        <HomeIcon class="h-3.5 w-3.5" />
        <span class="hidden sm:inline">Home</span>
      </button>

      {breadcrumbs.map((segment, i) => {
        const isLast = i === breadcrumbs.length - 1;
        return (
          <span key={segment.path} class="flex items-center">
            <ChevronRightIcon class="h-3.5 w-3.5 text-muted-foreground/60" />
            <button
              onClick={() => navigateTo(segment.path)}
              class={[
                'rounded-md px-1.5 py-0.5 transition-colors hover:bg-surface-hover hover:text-foreground truncate max-w-[120px] sm:max-w-[200px]',
                isLast ? 'text-foreground font-medium' : '',
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
