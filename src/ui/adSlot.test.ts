import { describe, expect, it } from 'vitest';
import { adMode } from './adSlot';

const base = { enabled: true, imageUrl: '', linkUrl: '' };

describe('adMode', () => {
  it('is off unless enabled, even with a full sponsor creative', () => {
    expect(adMode({ ...base, enabled: false, imageUrl: 'a.png', linkUrl: 'https://example.com' })).toBe('off');
  });

  it('shows the placeholder when enabled with no creative', () => {
    expect(adMode(base)).toBe('placeholder');
  });

  it('shows the placeholder when only half of a sponsor is set', () => {
    expect(adMode({ ...base, imageUrl: 'a.png' })).toBe('placeholder');
    expect(adMode({ ...base, linkUrl: 'https://example.com' })).toBe('placeholder');
  });

  it('shows the sponsor once both the image and the link are set', () => {
    expect(adMode({ ...base, imageUrl: 'a.png', linkUrl: 'https://example.com' })).toBe('sponsor');
  });
});
