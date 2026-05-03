import { useEffect, useRef } from 'preact/hooks';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: preact.ComponentChildren;
  footer?: preact.ComponentChildren;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Focus first focusable element
    const timer = setTimeout(() => {
      const focusable = dialogRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      focusable?.focus();
    }, 50);

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', handler);
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
  };

  return (
    <div
      ref={overlayRef}
      class="fixed inset-0 z-[120] flex items-center justify-center bg-background/70 backdrop-blur-sm animate-ql-fade-in"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        ref={dialogRef}
        class={[
          'w-full rounded-2xl border border-border/80 bg-surface/95 shadow-2xl backdrop-blur-xl animate-ql-pop-in mx-4',
          sizeClasses[size],
        ].join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div class="flex items-center justify-between border-b border-border/50 px-6 py-4">
          <h3 id="modal-title" class="text-lg font-semibold">{title}</h3>
          <button
            onClick={onClose}
            class="icon-button h-8 w-8"
            aria-label="Close"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div class="px-6 py-4">{children}</div>

        {footer && (
          <div class="flex items-center justify-end gap-2 border-t border-border/50 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
