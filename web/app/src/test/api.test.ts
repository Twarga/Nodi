import { describe, it, expect, vi } from 'vitest';
import { fetchJSON, downloadAPI } from '../lib/api';

describe('downloadAPI', () => {
  it('constructs download URL correctly', () => {
    expect(downloadAPI.downloadUrl('/folder/file.txt')).toBe('/api/download?path=%2Ffolder%2Ffile.txt');
  });

  it('constructs thumb URL correctly', () => {
    expect(downloadAPI.thumbUrl('image.png')).toBe('/api/thumb?path=image.png');
  });
});

describe('fetchJSON', () => {
  it('redirects to login on 401', async () => {
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: '' },
    });

    global.fetch = vi.fn(() =>
      Promise.resolve({ status: 401, ok: false } as Response)
    );

    await expect(fetchJSON('/api/test')).rejects.toThrow('Unauthorized');
    expect(window.location.href).toBe('/login');

    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
  });
});
