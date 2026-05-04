import React from 'react';
import {useCurrentFrame, interpolate, Easing} from 'remotion';

export const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();

  const logoScale = interpolate(frame, [0, 30], [0.8, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.elastic(1),
  });

  const titleOpacity = interpolate(frame, [10, 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const linkOpacity = interpolate(frame, [30, 60], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const ctaOpacity = interpolate(frame, [50, 80], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{transform: `scale(${logoScale})`}}>
        <svg width={140} height={140} viewBox="0 0 32 32" fill="none">
          <path d="M16 2.6L27.6 9.3V22.7L16 29.4L4.4 22.7V9.3L16 2.6Z" stroke="#0891b2" strokeWidth="2" strokeLinejoin="round"/>
          <path d="M16 16L16 2.6 M16 16L27.6 22.7 M16 16L4.4 22.7" stroke="#0891b2" strokeWidth="1.6" strokeLinecap="round" opacity="0.55"/>
          <circle cx="16" cy="2.6" r="2.2" fill="#0891b2"/>
          <circle cx="27.6" cy="22.7" r="2.2" fill="#0891b2"/>
          <circle cx="4.4" cy="22.7" r="2.2" fill="#0891b2"/>
          <circle cx="16" cy="16" r="2.8" fill="#0891b2"/>
        </svg>
      </div>

      <h1
        style={{
          fontSize: 64,
          fontWeight: 800,
          color: '#f8fafc',
          marginTop: 30,
          marginBottom: 10,
          opacity: titleOpacity,
        }}
      >
        Nodi
      </h1>

      <p
        style={{
          fontSize: 24,
          color: '#94a3b8',
          marginBottom: 40,
          opacity: titleOpacity,
        }}
      >
        Your files. Your server. Your rules.
      </p>

      <div
        style={{
          background: 'rgba(8, 145, 178, 0.15)',
          border: '1px solid rgba(8, 145, 178, 0.4)',
          borderRadius: 12,
          padding: '16px 40px',
          fontSize: 22,
          color: '#22d3ee',
          fontFamily: 'monospace',
          opacity: linkOpacity,
        }}
      >
        github.com/Twarga/Nodi
      </div>

      <div
        style={{
          marginTop: 40,
          padding: '14px 48px',
          borderRadius: 999,
          background: 'linear-gradient(90deg, #0891b2, #06b6d4)',
          color: '#fff',
          fontSize: 20,
          fontWeight: 700,
          opacity: ctaOpacity,
          boxShadow: '0 4px 20px rgba(8, 145, 178, 0.4)',
        }}
      >
        Star on GitHub
      </div>
    </div>
  );
};
