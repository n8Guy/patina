# /issue — Worked Examples

## Example 1: Clear, simple issue

**Input:** `/issue Add a logout button in the app menu`

_Analysis:_ Clear scope, obvious acceptance criteria, likely one issue.

**Output:**

```
Title: Add logout button to app menu
Description: Users need a way to log out from the app
Requirements:
- Button visible in app menu
- Clicking logs out user
- Redirects to login screen after logout

Acceptance Criteria:
- [ ] Logout button appears in menu
- [ ] Button triggers logout flow
- [ ] User session is cleared
- [ ] User is redirected to login screen
```

## Example 2: Vague issue

**Input:** `/issue Make the app faster`

_Analysis:_ Vague intent, unclear scope, no acceptance criteria. Ask questions.

**Questions:**

- What part of the app feels slow? (startup, navigation, data loading?)
- Have you measured performance? Do you have metrics?
- Is this a specific platform or all platforms?

Once answered, create focused issue around the actual bottleneck.

## Example 3: Complex feature to decompose

**Input:** `/issue Implement real-time notifications with push notifications`

_Analysis:_ Multiple components (backend infrastructure, client receiver, UI, settings), can be staged.

**Output:** Create 4 issues:

1. "Set up push notification service integration" (backend/infra)
2. "Handle push notifications on client" (client-side receiver)
3. "Create notification UI component" (depends on #2)
4. "Add notification preferences" (depends on #2)

With cross-references showing the dependency chain.

## Example 4: Missing README

**Input:** `/issue Add user authentication`

_Analysis:_ No README exists. Project goals unclear.

**Output:** Create 2 issues:

1. "Add project README.md" (with template sections)
2. "Implement user authentication" (with questions asked about project goals)
