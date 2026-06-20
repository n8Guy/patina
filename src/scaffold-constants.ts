/**
 * Shared constants for scaffold configuration.
 * Extracted into a standalone module to avoid circular dependencies.
 */

/**
 * Metadata for each predefined audience archetype.
 * To add a new one: create the template in src/templates/.claude/agents/,
 * add an entry here, and add tests per the CONTRIBUTING.md "Adding a predefined audience
 * archetype" guide. Each adapter's baseManagedPaths() derives paths from archetypePath()
 * automatically — no manual path registration needed.
 */
export const PREDEFINED_ARCHETYPES = [
  { slug: 'hiring-manager', name: 'Hiring Manager', hint: 'assesses job fit and team compatibility' },
  { slug: 'recruiter', name: 'Recruiter', hint: 'does the initial screen before the hiring manager' },
] as const;

export type PredefinedArchetypeSlug = typeof PREDEFINED_ARCHETYPES[number]['slug'];
