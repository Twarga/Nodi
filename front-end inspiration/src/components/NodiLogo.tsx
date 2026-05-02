import { SVGProps } from "react";

/**
 * Nodi logo — a hexagonal "node" mark.
 * A hexagon outline with three connecting nodes at alternating vertices
 * and a central hub, suggesting a connected file/network.
 */
export const NodiLogo = ({ className = "", ...props }: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    {...props}
  >
    {/* Outer hexagon */}
    <path
      d="M16 2.6L27.6 9.3V22.7L16 29.4L4.4 22.7V9.3L16 2.6Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    {/* Connecting lines from center to alternating vertices */}
    <path
      d="M16 16L16 2.6 M16 16L27.6 22.7 M16 16L4.4 22.7"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      opacity="0.55"
    />
    {/* Vertex nodes */}
    <circle cx="16" cy="2.6" r="2.2" fill="currentColor" />
    <circle cx="27.6" cy="22.7" r="2.2" fill="currentColor" />
    <circle cx="4.4" cy="22.7" r="2.2" fill="currentColor" />
    {/* Central hub */}
    <circle cx="16" cy="16" r="2.8" fill="currentColor" />
  </svg>
);
