import { describe, it, expect } from 'vitest';
import { nodeVersionMessage } from '../node-version-check.js';

describe('nodeVersionMessage', () => {
  it('returns null for Node 22', () => {
    expect(nodeVersionMessage('22.0.0')).toBeNull();
  });

  it('returns null for Node 24', () => {
    expect(nodeVersionMessage('24.1.0')).toBeNull();
  });

  it('returns upgrade message for Node 20 naming the detected version', () => {
    const msg = nodeVersionMessage('20.19.0');
    expect(msg).toContain('Node 22 or newer');
    expect(msg).toContain('20.19.0');
    expect(msg).toContain('nodejs.org');
  });

  it('returns upgrade message for Node 18', () => {
    expect(nodeVersionMessage('18.0.0')).not.toBeNull();
  });
});
