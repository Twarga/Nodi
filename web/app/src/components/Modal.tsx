import { useEffect, useRef } from 'preact/hooks';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: preact.ComponentChildren;
  footer?: preact.ComponentChildren;
  size?: 'sm' | 'md' | 'lg';
}

/* Modal is allowed to be a card surface — it's a form interaction. */
export function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
    // Intentionally only depend on open so this doesn't re-fire while typing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const sizeClasses = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' };

  return (
    <div
      ref={overlayRef}
      class="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-foreground/30 backdrop-blur-sm"
      style={{ animation: 'ql-fade-in 0.15s ease-out forwards' }}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        ref={dialogRef}
        class={['w-full bg-background border border-border rounded-[var(--radius)]', sizeClasses[size]].join(' ')}
        style={{ animation: 'ql-pop-in 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div class="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 id="modal-title" class="text-base font-medium tracking-tight">{title}</h3>
          <button onClick={onClose} class="icon-button h-7 w-7" aria-label="Close">
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div class="px-5 py-4">{children}</div>

        {footer && (
          <div class="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
