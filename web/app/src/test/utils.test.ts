import { describe, it, expect } from 'vitest';
import { formatBytes, formatDate, getFileIconColor } from '../lib/utils';

describe('formatBytes', () => {
  it('formats bytes correctly', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1024 * 1024)).toBe('1 MB');
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
  });

  it('formats with decimal', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
  });
});

describe('formatDate', () => {
  it('returns relative time for recent dates', () => {
    const now = new Date();
    const justNow = new Date(now.getTime() - 30 * 1000);
    expect(formatDate(justNow.toISOString())).toBe('Just now');
  });

  it('returns days ago for older dates', () => {
    const now = new Date();
    const daysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    expect(formatDate(daysAgo.toISOString())).toBe('3 days ago');
  });
});

describe('getFileIconColor', () => {
  it('returns image color for image mime', () => {
    expect(getFileIconColor('image/png')).toBe('text-icon-image');
  });

  it('returns video color for video mime', () => {
    expect(getFileIconColor('video/mp4')).toBe('text-icon-video');
  });

  it('returns pdf color for pdf', () => {
    expect(getFileIconColor('application/pdf')).toBe('text-icon-pdf');
  });

  it('returns generic for unknown', () => {
    expect(getFileIconColor('application/octet-stream')).toBe('text-icon-generic');
  });
});
