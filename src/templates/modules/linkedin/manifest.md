---
patina: managed
name: linkedin
label: LinkedIn
reflect_hook: li-all
description: A private drafting space for your LinkedIn profile
commands:
  - name: /li-all
    desc: Refresh all LinkedIn drafts at once from your latest notes (no input needed)
  - name: /li-about
    desc: Refine your About section draft (no input needed — {{AGENT_DISPLAY_NAME}} reads your graph)
  - name: /li-headline
    desc: Refine your headline draft (no input needed — {{AGENT_DISPLAY_NAME}} reads your graph)
  - name: /li-experience
    desc: Refine your experience section draft (no input needed — {{AGENT_DISPLAY_NAME}} reads your graph)
  - name: /li-skills
    desc: Refine your skills list draft (no input needed — {{AGENT_DISPLAY_NAME}} reads your graph)
  - name: /li-featured
    desc: Refine Featured or draft a post to pin (no input needed — {{AGENT_DISPLAY_NAME}} reads your graph)
  - name: /li-activity
    desc: Update your posting strategy or draft a post (no input needed — {{AGENT_DISPLAY_NAME}} reads your graph)
  - name: /li-draft
    desc: Promote a suggestion or start a new post/article draft
  - name: /li-post
    desc: Mark a draft as posted and move it to the posted folder
installed: {{TODAY}}
---

# LinkedIn Module

A private drafting workspace for your LinkedIn profile. You add notes about your work, and this module helps you turn those notes into polished copy for each section of your profile. When you're happy with a draft, you copy it into LinkedIn yourself — there's no automation, no API, and nothing leaves your computer until you decide it does.

## How it works

1. Use `/add` to capture your work — projects, skills, decisions, outcomes.
2. Run `/li-all` to turn your notes into drafts for every LinkedIn section at once.
3. Refine individual sections with `/li-about`, `/li-headline`, and the others.
4. When a section looks good, open the file, copy the text under **Proposed**, and paste it into the right place on your LinkedIn profile.
5. Once you've published a section, just tell {{AGENT_DISPLAY_NAME}} — *"I published my headline"* — and it will update your graph to reflect what's now live.

## Commands

| Command | What it does |
|---------|-------------|
| `/li-all` | Refresh all LinkedIn drafts from your latest notes |
| `/li-about` | Refine your About section draft |
| `/li-headline` | Refine your headline draft |
| `/li-experience` | Refine your experience section draft |
| `/li-skills` | Refine your skills list draft |
| `/li-featured` | Refine Featured or draft a post to pin |
| `/li-activity` | Update your posting strategy or draft a post |
| `/li-draft` | Promote a suggestion or start a new post/article draft |
| `/li-post` | Mark a draft as posted and move it to the posted folder |

## What this module does not do

It does not post to LinkedIn, access your LinkedIn account, or connect to LinkedIn in any way. LinkedIn does not have a public API for profile editing. Everything stays in your graph until you copy and paste it yourself.
