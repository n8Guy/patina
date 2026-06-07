import * as p from '@clack/prompts';
import chalk from 'chalk';
import { resolve } from 'path';
import { privacyNote, label } from './wizard-brand.js';
import { detectObsidian, openInObsidian, detectVSCode, openInVSCode, detectClaude } from './wizard-editor.js';
import { MULTISELECT_HINT, OPTIONAL_HINT, slugify, defaultSnoozeUntil, addDeferredModule, onCancel, promptLaunchTasks } from './wizard-shared.js';
import { scaffold } from './scaffold.js';
import { readState, writeState } from './state.js';
import { MODULES, getModule } from './modules/registry.js';
import { availableLaunchTasks } from './launch-tasks.js';
import type { ModuleAddInputs } from './modules/types.js';
import type { DeferredModule, Editor, ModuleId, WorkInfo } from './types.js';

// ─── Install ─────────────────────────────────────────────────────────────────

export async function runInstall(cwd: string): Promise<void> {
  p.intro(chalk.hex('#FFAB2E')("Looks like you're new to patina - Let's get you started!"));
  p.note(privacyNote(), chalk.bold.hex('#60A5FA')('Privacy first'));

  // ── Identity
  const identity = await p.group(
    {
      patinaName: () =>
        p.text({
          message: 'What do you want to call your patina?',
          placeholder: 'patina',
          defaultValue: 'patina',
          hint: chalk.hex('#64748B')('becomes your folder name'),
        }),

      userName: () =>
        p.text({
          message: "What's your name?",
          placeholder: 'Your full name',
          validate: (v) => (v.trim() === '' ? 'Name is required.' : undefined),
        }),

      title: () =>
        p.text({
          message: `What's your professional title?${OPTIONAL_HINT}`,
          placeholder: 'e.g. Senior Engineer, Creative Director, Freelance Photographer',
        }),

      roleDescription: () =>
        p.text({
          message: `Describe what you do — in your own words, not your title.${OPTIONAL_HINT}`,
          placeholder: 'e.g. I lead a small team building software for financial advisors',
        }),

      jobDescriptionUrl: () =>
        p.text({
          message: `Got a link to a job description or role overview?${OPTIONAL_HINT}`,
          placeholder: 'https://...',
        }),
    },
    { onCancel }
  );

  // ── Work
  console.log('');
  console.log(`  ${label('Where you work')}`);

  const selfEmployed = await p.confirm({
    message: 'Are you self-employed or freelance?',
    initialValue: false,
    hint: chalk.hex('#64748B')('↑/↓ arrow keys · y or n · enter to confirm'),
  });
  if (p.isCancel(selfEmployed)) onCancel();

  const companyLabel = selfEmployed
    ? "What's your company called?"
    : 'Where do you work?';

  const companyPlaceholder = selfEmployed ? 'Freelance' : 'Company or organisation name';

  const work = await p.group(
    {
      companyName: () =>
        p.text({
          message: selfEmployed ? companyLabel : `${companyLabel}${OPTIONAL_HINT}`,
          placeholder: companyPlaceholder,
          hint: selfEmployed ? chalk.hex('#64748B')('hit enter to use "Freelance"') : undefined,
        }),

      website: () =>
        p.text({
          message: `${selfEmployed ? 'Company website?' : 'Their website?'}${OPTIONAL_HINT}`,
          placeholder: 'https://...',
        }),

      companyDescription: () =>
        p.text({
          message: `${selfEmployed ? 'What does your company do?' : 'What does the company do?'}${OPTIONAL_HINT}`,
          placeholder: 'One or two sentences',
        }),
    },
    { onCancel }
  );

  // ── Setup
  console.log('');
  console.log(`  ${label('Setup')}`);

  const setup = await p.group(
    {
      editor: () =>
        p.select<Editor>({
          message: 'How do you want to view and edit your files?',
          options: [
            {
              value: 'obsidian',
              label: 'Obsidian',
              hint: chalk.hex('#64748B')('free app — adds AI access to your files'),
            },
            { value: 'vscode', label: 'VS Code' },
            { value: 'other', label: "I'll choose later" },
          ],
        }),

      modules: () =>
        p.multiselect<ModuleId>({
          message: `Which modules do you want to add?${MULTISELECT_HINT}`,
          options: MODULES.map(m => ({
            value: m.id as ModuleId,
            label: m.label,
            hint: chalk.hex('#64748B')(m.hint),
          })),
          required: false,
        }),
    },
    { onCancel }
  );

  const modules: ModuleId[] = Array.isArray(setup.modules) ? setup.modules : [];

  // ── Per-module now/later prompts (generic — driven by requiresConfig on each module def)
  const moduleInputs: Record<string, ModuleAddInputs> = {};
  const deferredModules: DeferredModule[] = [];
  for (const moduleId of modules.filter(m => getModule(m)?.requiresConfig)) {
    const def = getModule(moduleId)!;
    const choice = await p.select({
      message: `Set up ${def.label} now or fill it out later?`,
      options: [
        { value: 'now', label: 'Fill out now' },
        { value: 'later', label: 'Fill out later', hint: chalk.hex('#64748B')("I'll remind you next session") },
      ],
    });
    if (p.isCancel(choice)) onCancel();
    if (choice === 'now') {
      if (def.promptsOnAdd) {
        const inputs = await def.promptsOnAdd();
        moduleInputs[moduleId] = inputs;
      }
    } else {
      deferredModules.push({ module: moduleId, snooze_until: defaultSnoozeUntil() });
    }
  }

  // ── Launch tasks
  let launchTasks: string[] = [];
  const availTasks = availableLaunchTasks(modules);
  if (availTasks.length > 0) {
    const setupLaunch = await p.confirm({
      message: 'Would you like to set up launch tasks?',
      initialValue: false,
    });
    if (p.isCancel(setupLaunch)) onCancel();
    if (setupLaunch) {
      launchTasks = await promptLaunchTasks(availTasks, []);
    }
  }

  // ── Scaffold
  const slug = slugify(identity.patinaName);
  const targetDir = resolve(cwd, slug);

  const s = p.spinner();
  s.start(chalk.hex('#C084FC')('Creating your patina...'));

  const workInfo: WorkInfo = {
    self_employed: selfEmployed as boolean,
    company_name: work.companyName?.trim() || (selfEmployed ? 'Freelance' : ''),
    website: work.website?.trim() || undefined,
    company_description: work.companyDescription?.trim() || undefined,
  };

  // Derive liProfileUrl for scaffold from collected inputs (linkedin may not be selected)
  const liProfileUrl = (moduleInputs['linkedin']?.liProfileUrl as string | undefined) ?? '';

  try {
    await scaffold({
      targetDir,
      patinaName: identity.patinaName,
      userName: identity.userName.trim(),
      title: (identity.title ?? '').trim(),
      roleDescription: (identity.roleDescription ?? '').trim(),
      jobDescriptionUrl: (identity.jobDescriptionUrl ?? '').trim(),
      work: workInfo,
      editor: setup.editor,
      modules,
      liProfileUrl,
      contentDir: 'graph',
      launchTasks,
    });

    // Merge deferred entries into state after scaffold has written .patina-state.json with checksums.
    // Never clobber the checksums scaffold just wrote — read first, then merge.
    if (deferredModules.length > 0) {
      let state = readState(targetDir);
      for (const entry of deferredModules) {
        state = addDeferredModule(state, entry.module, entry.snooze_until);
      }
      writeState(targetDir, state);
    }

    s.stop(chalk.green('Done.'));
  } catch (err) {
    s.stop(chalk.red('Something went wrong.'));
    p.log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  // Your patina is driven by Claude Code. If it isn't installed, the "run claude"
  // step below would dead-end at "command not found" — surface an install pointer first.
  if (!detectClaude()) {
    p.note(
      chalk.hex('#94A3B8')("Your patina is powered by Claude Code, which doesn't look installed yet.\nInstall it (free) here: ") +
        chalk.bold.white('https://claude.ai/code'),
      label('Install Claude Code')
    );
  }

  if (setup.editor === 'obsidian') {
    if (detectObsidian()) {
      p.note(
        chalk.hex('#94A3B8')('In Obsidian, click ') + chalk.bold.white('"Open folder as vault"') + chalk.hex('#94A3B8')(' and select:\n  ') + chalk.bold.white(targetDir) +
        chalk.hex('#94A3B8')('\n\nThen open a terminal and run ') + chalk.bold.white('claude') + chalk.hex('#94A3B8')(' to get started.'),
        label('Next steps')
      );
      p.outro(chalk.hex('#C084FC')('Opening in Obsidian...'));
      openInObsidian();
    } else {
      p.note(
        chalk.hex('#94A3B8')('Download Obsidian at ') + chalk.bold.white('https://obsidian.md/download') +
        chalk.hex('#94A3B8')('\n\nThen open the folder as a vault:\n  ') + chalk.bold.white(targetDir),
        label('Next steps')
      );
      p.outro(chalk.hex('#94A3B8')('Run claude from inside your patina to get started.'));
    }
  } else if (setup.editor === 'vscode') {
    if (detectVSCode()) {
      p.note(
        chalk.hex('#94A3B8')('Open a terminal in VS Code and run ') + chalk.bold.white('claude') + chalk.hex('#94A3B8')('.'),
        label('Next steps')
      );
      p.outro(chalk.hex('#60A5FA')('Opening in VS Code...'));
      openInVSCode(targetDir);
    } else {
      p.note(
        chalk.hex('#94A3B8')('Download VS Code at ') + chalk.bold.white('https://code.visualstudio.com') +
        chalk.hex('#94A3B8')('\n\nThen open the folder and run ') + chalk.bold.white('claude') + chalk.hex('#94A3B8')(' in the terminal.'),
        label('Next steps')
      );
      p.outro(chalk.hex('#94A3B8')('Run claude from inside your patina to get started.'));
    }
  } else {
    p.note(
      [
        chalk.hex('#94A3B8')('  cd ') + chalk.bold.white(slug),
        chalk.hex('#94A3B8')('  claude'),
      ].join('\n'),
      label('Next steps')
    );
    p.outro(chalk.hex('#94A3B8')('Run claude from inside your patina to get started.'));
  }
}
