import React from 'react';
import {useCurrentFrame, interpolate, Easing} from 'remotion';

const FeatureCard: React.FC<{
  icon: string;
  title: string;
  desc: string;
  delay: number;
  frame: number;
}> = ({icon, title, desc, delay, frame}) => {
  const progress = interpolate(frame, [delay, delay + 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  return (
    <div
      style={{
        background: 'rgba(30, 41, 59, 0.8)',
        border: '1px solid rgba(148, 163, 184, 0.1)',
        borderRadius: 16,
        padding: 32,
        width: 320,
        transform: `translateY(${(1 - progress) * 40}px)`,
        opacity: progress,
        backdropFilter: 'blur(10px)',
      }}
    >
      <div style={{fontSize: 40, marginBottom: 16}}>{icon}</div>
      <h3 style={{fontSize: 22, fontWeight: 700, color: '#f8fafc', marginBottom: 8}}>{title}</h3>
      <p style={{fontSize: 16, color: '#94a3b8', lineHeight: 1.5}}>{desc}</p>
    </div>
  );
};

export const FeaturesScene: React.FC = () => {
  const frame = useCurrentFrame();

  const titleProgress = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: 60,
      }}
    >
      <h2
        style={{
          fontSize: 48,
          fontWeight: 800,
          color: '#f8fafc',
          marginBottom: 60,
          opacity: titleProgress,
        }}
      >
        Everything You Need
      </h2>

      <div
        style={{
          display: 'flex',
          gap: 24,
          justifyContent: 'center',
          flexWrap: 'wrap',
        }}
      >
        <FeatureCard
          icon="📁"
          title="Browse & Manage"
          desc="Intuitive file browser with grid and list views, breadcrumbs, and instant search"
          delay={10}
          frame={frame}
        />
        <FeatureCard
          icon="☁️"
          title="Upload & Download"
          desc="Drag-and-drop uploads with progress bars. Download individual files or entire folders as ZIP"
          delay={25}
          frame={frame}
        />
        <FeatureCard
          icon="🔗"
          title="Share Links"
          desc="Create password-protected share links with expiry dates for files and folders"
          delay={40}
          frame={frame}
        />
        <FeatureCard
          icon="🎬"
          title="Media Streaming"
          desc="Built-in video player with HTTP range support. Preview images, PDFs, and text files"
          delay={55}
          frame={frame}
        />
        <FeatureCard
          icon="🗑️"
          title="Trash & Restore"
          desc="Soft-delete with trash recovery. Never lose a file accidentally again"
          delay={70}
          frame={frame}
        />
        <FeatureCard
          icon="🌙"
          title="Dark Mode"
          desc="Beautiful dark and light themes with system-aware auto-switching"
          delay={85}
          frame={frame}
        />
      </div>
    </div>
  );
};
