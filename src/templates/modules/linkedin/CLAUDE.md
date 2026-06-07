# LinkedIn Module Context

This module helps you draft and refine your LinkedIn profile using your patina graph as the source of truth.

## Folder structure

```
{{CONTENT_DIR}}/linkedin/
  INSTRUCTIONS.md              — module-specific rules and guidance
  LinkedIn Current State.md    — your current live profile copy
  LinkedIn About.md            — draft for the About section
  LinkedIn Headline.md         — draft for your headline
  LinkedIn Experience.md       — draft for your experience entries
  LinkedIn Skills.md           — draft for your skills section
  LinkedIn Featured.md         — draft for featured content
  LinkedIn Activity.md         — draft for activity/posts section
```

## Slash commands

| Command | What it does |
|---------|-------------|
| `/li-all` | Run all LinkedIn section drafts in sequence |
| `/li-about` | Draft or refine your LinkedIn About section |
| `/li-headline` | Draft or refine your LinkedIn headline |
| `/li-experience` | Draft or refine your LinkedIn experience entries |
| `/li-skills` | Draft or refine your LinkedIn skills section |
| `/li-featured` | Draft or refine your LinkedIn featured content |
| `/li-activity` | Draft or refine your LinkedIn activity section |

## How it works

LinkedIn commands read your `{{CONTENT_DIR}}/` graph — notes, skills, and posts — and draft profile copy grounded in that evidence. They never invent claims not supported by your notes.

The `/reflect` command also runs the LinkedIn reflect hook (`/li-all`) to keep your drafts current.

## Sharing

This module never auto-publishes — you copy drafts into LinkedIn yourself, so you are the final reviewer. It gives one heads-up before a draft uses anything marked `private: true` or that reads as sensitive, then leaves the decision to you. See **Sharing is your call** in `{{CONTENT_DIR}}/linkedin/INSTRUCTIONS.md`.
