import type { JSX } from 'preact';

interface LogoProps extends JSX.SVGAttributes<SVGSVGElement> {
  size?: number;
}

/**
 * Nodi brand mark — outlined hexagon enclosing a stylized "N"
 * with two terminator nodes (circuit/node motif). Single teal stroke.
 *
 * Pass `size` (px) or override via class. Uses `currentColor` so the
 * mark adapts via Tailwind text color utilities; defaults to cyan-700
 * via the `text-[color]` style on the SVG root.
 */
export function Logo({ size = 24, class: className, ...rest }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      class={['text-[#1a8a9e]', className].filter(Boolean).join(' ')}
      {...rest}
    >
      {/* Hexagon outline (flat-top) */}
      <path
        d="M20 11.22 L44 11.22 L56 32 L44 52.78 L20 52.78 L8 32 Z"
        stroke="currentColor"
        stroke-width="3"
        stroke-linejoin="round"
        stroke-linecap="round"
        fill="none"
      />
      {/* "N" stroke: left vertical → diagonal → right vertical */}
      <path
        d="M22 43 L22 23 L42 43 L42 23"
        stroke="currentColor"
        stroke-width="3.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        fill="none"
      />
      {/* Terminator nodes */}
      <circle cx="22" cy="46" r="2.8" fill="currentColor" />
      <circle cx="42" cy="20" r="2.8" fill="currentColor" />
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
