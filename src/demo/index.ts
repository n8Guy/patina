import * as p from '@clack/prompts';
import chalk from 'chalk';
import { resolve, join, dirname } from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import { scaffold, profileToVars } from '../scaffold.js';
import { MODULES, getModule } from '../modules/registry.js';
import { markDemo } from './mark.js';
import type { ModuleId } from '../types.js';
import { DEMO_TODAY, DEMO_PERSONA, DEMO_GRAPH_FILES } from './persona.js';

const MULTISELECT_HINT = `\n  ${chalk.hex('#64748B')('↑↓ to move  ·  space to select  ·  enter to confirm')}`;

function writeRaw(targetDir: string, relativePath: string, content: string): void {
  const full = join(targetDir, relativePath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content, 'utf8');
}

export async function runDemo(cwd: string): Promise<void> {
  // Print demo banner
  console.log('');
  console.log(
    `  ${chalk.bold.hex('#C084FC')('patina')} ${chalk.hex('#64748B')('—')} ${chalk.hex('#FFAB2E')('demo mode')}`,
  );
  console.log(
    `  ${chalk.hex('#94A3B8')('Creates a fully-populated example patina using a fictional persona.')}`,
  );
  console.log(
    `  ${chalk.hex('#64748B')('No real data will be used or modified.')}`,
  );
  console.log('');

  p.intro(chalk.hex('#94A3B8')("Let's build a demo patina for Mara Ellison."));

  // Module multiselect — same pattern as runInstall
  const selectedRaw = await p.multiselect<ModuleId>({
    message: `Which modules do you want in the demo?${MULTISELECT_HINT}`,
    options: MODULES.map(m => ({
      value: m.id as ModuleId,
      label: m.label,
      hint: chalk.hex('#64748B')(m.hint),
    })),
    initialValues: MODULES.map(m => m.id as ModuleId),
    required: false,
  });

  if (p.isCancel(selectedRaw)) {
    p.cancel(chalk.hex('#94A3B8')('Demo cancelled.'));
    process.exit(0);
  }

  const modules: ModuleId[] = Array.isArray(selectedRaw) ? (selectedRaw as ModuleId[]) : [];

  const targetDir = resolve(cwd, 'patina-demo');

  const s = p.spinner();
  s.start(chalk.hex('#C084FC')('Scaffolding demo patina...'));

  try {
    await scaffold({
      ...DEMO_PERSONA,
      modules,
      targetDir,
    });
  } catch (err) {
    s.error('Scaffold failed.');
    p.log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  // Write DEMO_GRAPH_FILES (stamped with _demo: true via markDemo)
  for (const [relativePath, content] of DEMO_GRAPH_FILES) {
    writeRaw(targetDir, relativePath, markDemo(content));
  }

  // Call each selected module's demoContent() and write those files
  // Build vars from DEMO_PERSONA fields directly (same as scaffold() does internally)
  const vars = profileToVars(
    {
      patina_name: DEMO_PERSONA.patinaName,
      name: DEMO_PERSONA.userName,
      title: DEMO_PERSONA.title,
      role_description: DEMO_PERSONA.roleDescription,
      job_description_url: DEMO_PERSONA.jobDescriptionUrl || undefined,
      work: DEMO_PERSONA.work,
      editor: DEMO_PERSONA.editor,
      modules,
      content_dir: DEMO_PERSONA.contentDir,
      created: DEMO_TODAY,
      _demo: true,
      ...(modules.includes('linkedin') && DEMO_PERSONA.liProfileUrl
        ? { linkedin: { profile_url: DEMO_PERSONA.liProfileUrl } }
        : {}),
    },
    DEMO_PERSONA.liProfileUrl,
    DEMO_TODAY,
  );

  for (const moduleId of modules) {
    const def = getModule(moduleId);
    if (!def) throw new Error(`Module "${moduleId}" not found in registry`);
    for (const [relativePath, content] of def.demoContent(vars, DEMO_PERSONA.contentDir)) {
      writeRaw(targetDir, relativePath, markDemo(content));
    }
  }

  s.stop(chalk.green('Done.'));

  p.note(
    [
      chalk.hex('#94A3B8')('Created demo patina at:'),
      chalk.bold.white(`  ${targetDir}`),
      '',
      chalk.hex('#94A3B8')('To explore it:'),
      chalk.hex('#94A3B8')('  cd ') + chalk.bold.white('patina-demo'),
      chalk.hex('#94A3B8')('  claude'),
      '',
      chalk.hex('#64748B')('To delete it:'),
      chalk.dim('  rm -rf patina-demo/'),
    ].join('\n'),
    chalk.bold.hex('#C084FC')('Demo created'),
  );

  p.outro(
    chalk.hex('#94A3B8')(
      'This is a demo patina — no real data was used or modified.',
    ),
  );
}
