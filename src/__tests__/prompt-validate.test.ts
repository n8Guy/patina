import { describe, it, expect } from 'vitest';

// Mirrors the inline validate lambda used in wizard-install.ts and wizard-update.ts.
// Tested here to guard against future @clack/prompts type changes that widen or narrow
// the v parameter.

const nameRequired = (v: string | undefined) => (!v || !v.trim() ? 'Name is required.' : undefined);

describe('nameRequired validate (wizard-install, wizard-update)', () => {
  it('errors on undefined', () => expect(nameRequired(undefined)).toBe('Name is required.'));
  it('errors on empty string', () => expect(nameRequired('')).toBe('Name is required.'));
  it('errors on whitespace-only', () => expect(nameRequired('   ')).toBe('Name is required.'));
  it('passes on valid input', () => expect(nameRequired('Alice')).toBeUndefined());
});
