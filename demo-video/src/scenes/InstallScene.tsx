import React from 'react';
import {useCurrentFrame, interpolate, Easing} from 'remotion';

const CodeBlock: React.FC<{code: string; delay: number; frame: number}> = ({
  code,
  delay,
  frame,
}) => {
  const progress = interpolate(frame, [delay, delay + 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  return (
    <div
      style={{
        background: '#0f172a',
        border: '1px solid rgba(148, 163, 184, 0.15)',
        borderRadius: 12,
        padding: '20px 28px',
        fontFamily: 'monospace',
        fontSize: 18,
        color: '#22d3ee',
        transform: `translateX(${(1 - progress) * 60}px)`,
        opacity: progress,
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      }}
    >
      <span style={{color: '#64748b'}}>$</span> {code}
    </div>
  );
};

export const InstallScene: React.FC = () => {
  const frame = useCurrentFrame();

  const titleProgress = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const subtitleProgress = interpolate(frame, [15, 35], [0, 1], {
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
      <h2
        style={{
          fontSize: 52,
          fontWeight: 800,
          color: '#f8fafc',
          marginBottom: 20,
          opacity: titleProgress,
        }}
      >
        Deploy in Seconds
      </h2>

      <p
        style={{
          fontSize: 24,
          color: '#94a3b8',
          marginBottom: 50,
          opacity: subtitleProgress,
        }}
      >
        One command. One folder. One backup.
      </p>

      <div style={{display: 'flex', flexDirection: 'column', gap: 16, width: 700}}>
        <CodeBlock
          code="curl -fsSL .../install.sh | bash"
          delay={30}
          frame={frame}
        />
        <CodeBlock
          code="docker compose up -d"
          delay={50}
          frame={frame}
        />
        <CodeBlock
          code="systemctl enable nodi"
          delay={70}
          frame={frame}
        />
      </div>

      <div
        style={{
          marginTop: 50,
          display: 'flex',
          gap: 40,
          opacity: interpolate(frame, [90, 110], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        }}
      >
        {['Docker', 'Docker Compose', 'Systemd'].map((tech) => (
          <div
            key={tech}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              color: '#94a3b8',
              fontSize: 18,
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: '#22d3ee',
              }}
            />
            {tech}
          </div>
        ))}
      </div>
    </div>
  );
};
