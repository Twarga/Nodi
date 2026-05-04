import React from 'react';
import {Sequence, useCurrentFrame, useVideoConfig, interpolate, Easing} from 'remotion';

const NodiLogo: React.FC<{scale?: number}> = ({scale = 1}) => (
  <svg width={120 * scale} height={120 * scale} viewBox="0 0 32 32" fill="none">
    <path d="M16 2.6L27.6 9.3V22.7L16 29.4L4.4 22.7V9.3L16 2.6Z" stroke="#0891b2" strokeWidth="2" strokeLinejoin="round"/>
    <path d="M16 16L16 2.6 M16 16L27.6 22.7 M16 16L4.4 22.7" stroke="#0891b2" strokeWidth="1.6" strokeLinecap="round" opacity="0.55"/>
    <circle cx="16" cy="2.6" r="2.2" fill="#0891b2"/>
    <circle cx="27.6" cy="22.7" r="2.2" fill="#0891b2"/>
    <circle cx="4.4" cy="22.7" r="2.2" fill="#0891b2"/>
    <circle cx="16" cy="16" r="2.8" fill="#0891b2"/>
  </svg>
);

export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();

  const logoScale = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: 'clamp',
    easing: Easing.elastic(1),
  });

  const titleOpacity = interpolate(frame, [20, 50], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const subtitleOpacity = interpolate(frame, [40, 70], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const exitProgress = interpolate(frame, [durationInFrames - 30, durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const exitY = exitProgress * -100;
  const exitOpacity = 1 - exitProgress;

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
        transform: `translateY(${exitY}px)`,
        opacity: exitOpacity,
      }}
    >
      <div style={{transform: `scale(${logoScale})`}}>
        <NodiLogo scale={2} />
      </div>

      <h1
        style={{
          fontSize: 80,
          fontWeight: 800,
          color: '#f8fafc',
          marginTop: 40,
          marginBottom: 20,
          letterSpacing: '-0.02em',
          opacity: titleOpacity,
          textShadow: '0 0 60px rgba(8, 145, 178, 0.3)',
        }}
      >
        Nodi
      </h1>

      <p
        style={{
          fontSize: 32,
          color: '#94a3b8',
          fontWeight: 400,
          opacity: subtitleOpacity,
          letterSpacing: '0.05em',
        }}
      >
        Self-Hosted File Manager
      </p>

      <div
        style={{
          marginTop: 30,
          padding: '12px 32px',
          borderRadius: 999,
          background: 'rgba(8, 145, 178, 0.15)',
          border: '1px solid rgba(8, 145, 178, 0.3)',
          fontSize: 18,
          color: '#22d3ee',
          opacity: subtitleOpacity,
        }}
      >
        Lightweight · Secure · Beautiful
      </div>
    </div>
  );
};
