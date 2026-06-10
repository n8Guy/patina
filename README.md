# patina

Your professional story, organised.

Patina is a personal knowledge system that helps you keep track of your work — the skills you've built, the projects you've shipped, the things you're proud of — and turns that into polished content when you need it. LinkedIn profile, resume, bio, posts. Whatever you're working on.

You add notes as you go. Patina remembers. When something needs writing, the hard part is already done.

---

## Who is this for?

Anyone who does work worth talking about and finds it hard to articulate it. Engineers, designers, marketers, photographers, teachers, consultants — if you've ever stared at a blank "About" section wondering where to start, patina is for you.

It works best if you use [Claude](https://claude.ai) and have [Claude Code](https://claude.ai/code) installed.

---

## Getting started

Requires **Node 22 or newer** ([download](https://nodejs.org)).

Run this in your terminal:

```bash
npx my-patina@latest
```

Or via GitHub directly: `npx github:n8Guy/patina`

You'll be asked a few questions — your name, what you do, where you work. Everything you enter stays on your computer. Nothing is sent anywhere.

When it's done, you'll have a folder with everything set up. Open that folder with Claude Code and you're ready to go.

---

## How it works

**Add things as you go.** Whenever something worth remembering happens — a project ships, you learn something new, you solve a hard problem — run `/add` and describe it. Claude asks a few follow-up questions and writes it down.

**Reflect periodically.** Run `/reflect` to take stock of everything you've captured. It surfaces things you've finished, skills that haven't been written up yet, and anything that might be out of date.

**Generate content when you need it.** Install a module (like LinkedIn) and Claude can turn your notes into polished drafts for your profile, resume, or wherever else you need to show up professionally.

---

## Modules

Modules are optional add-ons that connect your graph to specific outputs. Install only what you need.

### LinkedIn

Drafts and refines all six sections of your LinkedIn profile — headline, About, Experience, Skills, Featured, and Activity. Everything is grounded in your actual notes.

**How publishing works:** LinkedIn doesn't have an API, so nothing is automated. When a draft looks good, you copy the text and paste it into LinkedIn yourself. When you've done it, just tell Claude — *"I published my headline"* — and your graph is updated.

**To add LinkedIn during setup:** select it when the wizard asks which modules to install.

---

## Your files

Everything lives in a folder called `graph/` inside your patina:

```
your-patina/
├── profile.yaml          your identity — name, title, company, etc.
├── CLAUDE.md             context Claude reads at the start of every session
├── graph/
│   ├── notes/            things you've added with /add
│   ├── skills/           your skill inventory, built from notes
│   └── posts/            drafts ready to share
└── .claude/
    └── commands/         the slash commands that power everything
```

These are plain markdown files. Open them in any editor — [Obsidian](https://obsidian.md), VS Code, or whatever you prefer.

---

## Updating

Run the same command again from inside your patina folder:

```bash
cd your-patina
npx my-patina@latest
```

Patina detects that it's already set up and shows you your current profile. It can update your personal info or add new modules. Your notes and skills are never touched.

---

## Privacy

Everything stays on your computer. Patina doesn't connect to the internet, doesn't send your data anywhere, and doesn't require an account. Your files are yours.

The only network calls happen when you run Claude — which is between you and Anthropic, governed by their [privacy policy](https://www.anthropic.com/privacy).

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## License

MIT
