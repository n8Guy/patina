import { describe, it, expect } from 'vitest';
import { slugify } from '../wizard.js';

// The wizard's interactive prompts can't be unit-tested directly,
// but the pure logic functions can.

describe('slugify', () => {
  it('lowercases input', () => {
    expect(slugify('Patina')).toBe('patina');
  });

  it('replaces spaces with hyphens', () => {
    expect(slugify('my patina')).toBe('my-patina');
  });

  it('replaces multiple consecutive special chars with a single hyphen', () => {
    expect(slugify('hello   world')).toBe('hello-world');
  });

  it('strips leading and trailing hyphens', () => {
    expect(slugify('  patina  ')).toBe('patina');
  });

  it('handles special characters', () => {
    expect(slugify("Jane's Patina!")).toBe('jane-s-patina');
  });

  it('falls back to "patina" for empty or whitespace-only input', () => {
    expect(slugify('')).toBe('patina');
    expect(slugify('   ')).toBe('patina');
  });

  it('handles already-valid slugs unchanged', () => {
    expect(slugify('my-patina')).toBe('my-patina');
  });
});
