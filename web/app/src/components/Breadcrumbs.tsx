import { appState } from '../stores/app';
import { useState } from 'preact/hooks';

function ChevronRightIcon() {
  return <svg class="h-3 w-3 text-foreground-subtle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><polyline points="9 18 15 12 9 6"/></svg>;
}

interface BreadcrumbsProps {
  onNavigate: (path: string) => void;
}

export function Breadcrumbs({ onNavigate }: BreadcrumbsProps) {
  const { breadcrumbs, currentPath } = appState.value;
  const [copied, setCopied] = useState(false);

  const copyPath = async () => {
    try {
      await navigator.clipboard.writeText(currentPath || '/');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <nav class="flex items-center gap-1 text-sm flex-wrap" aria-label="Breadcrumb">
      <button
        onClick={() => onNavigate('')}
        class={['inline-flex items-center px-1 py-0.5 transition-colors border-none bg-transparent cursor-pointer',
          currentPath === '' ? 'text-foreground font-medium' : 'text-foreground-muted hover:text-foreground'].join(' ')}
        title="Home"
      >
        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        </svg>
        <span class="ml-1.5 hidden sm:inline">Home</span>
      </button>

      {breadcrumbs.map((segment, i) => {
        const isLast = i === breadcrumbs.length - 1;
        return (
          <span key={segment.path} class="flex items-center gap-1">
            <ChevronRightIcon />
            <button
              onClick={() => onNavigate(segment.path)}
              class={['inline-block px-1 py-0.5 transition-colors border-none bg-transparent cursor-pointer truncate max-w-[120px] sm:max-w-[200px]',
                isLast ? 'text-foreground font-medium' : 'text-foreground-muted hover:text-foreground'].join(' ')}
              title={segment.name}
            >
              {segment.name}
            </button>
          </span>
        );
      })}

      {currentPath && (
        <button
          onClick={copyPath}
          class="ml-2 text-xs text-foreground-subtle hover:text-foreground transition-colors border-none bg-transparent cursor-pointer px-1.5 py-0.5"
          title="Copy path"
        >
          {copied ? 'Copied' : 'Copy path'}
        </button>
      )}
    </nav>
  );
}
