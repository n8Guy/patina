import { describe, it, expect } from 'vitest';
import { render } from '../template.js';

describe('render', () => {
  it('replaces a known variable', () => {
    expect(render('Hello {{NAME}}', { NAME: 'World' })).toBe('Hello World');
  });

  it('leaves unknown variables intact', () => {
    expect(render('Hello {{UNKNOWN}}', {})).toBe('Hello {{UNKNOWN}}');
  });

  it('replaces multiple occurrences of the same variable', () => {
    expect(render('{{X}} and {{X}}', { X: 'yes' })).toBe('yes and yes');
  });

  it('replaces multiple different variables', () => {
    expect(render('{{A}} {{B}}', { A: 'foo', B: 'bar' })).toBe('foo bar');
  });

  it('handles empty string replacement', () => {
    expect(render('Hello {{NAME}}!', { NAME: '' })).toBe('Hello !');
  });

  it('does not replace partial matches', () => {
    expect(render('{{NAME}', { NAME: 'x' })).toBe('{{NAME}');
  });

  it('returns the template unchanged when no variables are present', () => {
    const t = 'no variables here';
    expect(render(t, { X: 'y' })).toBe(t);
  });
});
