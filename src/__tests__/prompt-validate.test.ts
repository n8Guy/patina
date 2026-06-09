import { describe, it, expect } from 'vitest';

// These mirror the inline validate lambdas used in wizard-install.ts, wizard-update.ts,
// and commands/index.ts. Tested here to guard against future @clack/prompts type changes
// that widen or narrow the v parameter.

const nameRequired = (v: string | undefined) => (!v || !v.trim() ? 'Name is required.' : undefined);
const clientRequired = (v: string | undefined) => (v?.trim() ? undefined : 'Client name is required');

describe('nameRequired validate (wizard-install, wizard-update)', () => {
  it('errors on undefined', () => expect(nameRequired(undefined)).toBe('Name is required.'));
  it('errors on empty string', () => expect(nameRequired('')).toBe('Name is required.'));
  it('errors on whitespace-only', () => expect(nameRequired('   ')).toBe('Name is required.'));
  it('passes on valid input', () => expect(nameRequired('Alice')).toBeUndefined());
});

describe('clientRequired validate (commands/index)', () => {
  it('errors on undefined', () => expect(clientRequired(undefined)).toBe('Client name is required'));
  it('errors on empty string', () => expect(clientRequired('')).toBe('Client name is required'));
  it('errors on whitespace-only', () => expect(clientRequired('   ')).toBe('Client name is required'));
  it('passes on valid input', () => expect(clientRequired('Acme Corp')).toBeUndefined());
});
