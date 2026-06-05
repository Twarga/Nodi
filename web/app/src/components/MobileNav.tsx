import { navigate, currentRoute } from '../lib/router';
import { useAuth } from '../stores/auth';

function FilesIcon({ class: cls }: { class?: string }) {
  return <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>;
}
function SendIcon({ class: cls }: { class?: string }) {
  return <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
}
function ShareIcon({ class: cls }: { class?: string }) {
  return <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>;
}
function DevicesIcon({ class: cls }: { class?: string }) {
  return <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>;
}

const items = [
  { id: 'files', label: 'Files', icon: FilesIcon },
  { id: 'send', label: 'Send', icon: SendIcon },
  { id: 'share', label: 'Shares', icon: ShareIcon },
  { id: 'devices', label: 'Devices', icon: DevicesIcon },
];

export function MobileNav() {
  const { state } = useAuth();
  const route = currentRoute.value;

  if (!state.value.user) return null;

  return (
    <nav class="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border bg-background pb-safe sm:hidden">
      {items.map((item) => {
        const active = route === item.id;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => navigate(`/${item.id}`)}
            class="flex flex-col items-center justify-center gap-0.5 py-2.5 px-3 min-w-[4rem] border-none bg-transparent cursor-pointer transition-colors"
          >
            <Icon class={['h-5 w-5', active ? 'text-primary' : 'text-foreground-muted'].join(' ')} />
            <span class={['text-[10px] font-medium', active ? 'text-primary' : 'text-foreground-muted'].join(' ')}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
