import { Command } from 'commander';
import * as p from '@clack/prompts';
import { existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { slugify } from '../wizard.js';
import { buildClientFiles } from '../modules/clients/scaffold-client.js';
import { findPatinaRoot } from '../validate.js';
import { loadProfile } from '../detect.js';
import { writeFileEntry } from './utils.js';

const VALID_ENGAGEMENT_TYPES = ['project', 'retainer', 'advisory'] as const;
type EngagementType = (typeof VALID_ENGAGEMENT_TYPES)[number];

function isEngagementType(value: string): value is EngagementType {
  return (VALID_ENGAGEMENT_TYPES as readonly string[]).includes(value);
}

// Register all noun-group subcommands (e.g. patina client add).
// Each noun module creates a Command and adds its verbs, then calls program.addCommand().
export function registerCommands(program: Command): void {
  const clientCmd = new Command('client')
    .description('Manage client relationships (patina client <verb>)');

  clientCmd
    .command('add')
    .description('Scaffold a new client folder')
    .option('--name <name>', 'client name')
    .option('--type <type>', 'engagement type: project | retainer | advisory')
    .option('--private', 'flag this client as private — outbound drafts will warn before using it (default: not private)')
    .action(async (opts: { name?: string; type?: string; private?: boolean }) => {
      // 1. Find patina root
      const cwd = process.cwd();
      const root = findPatinaRoot(cwd);
      if (root === null) {
        console.error(chalk.red('No patina found here. Run this command from inside a patina directory.'));
        process.exit(1);
      }

      // 2. Load profile for contentDir + today
      const profile = loadProfile(root);
      const contentDir = profile.content_dir ?? 'graph';
      const today = new Date().toISOString().split('T')[0];

      // 3. Detect headless (no TTY) — fail fast if required flags missing
      const isHeadless = !process.stdin.isTTY;

      let name = opts.name;
      let engagementType = opts.type;
      // Default-allow: clients are not private unless --private is passed (or set later).
      const isPrivate = opts.private === true;

      if (isHeadless) {
        // Headless mode: all required flags must be present
        if (!name) {
          console.error(chalk.red('--name is required in headless (non-interactive) mode.'));
          process.exit(1);
        }
        if (!engagementType) {
          console.error(chalk.red('--type is required in headless (non-interactive) mode. Valid values: project | retainer | advisory'));
          process.exit(1);
        }
        if (!isEngagementType(engagementType)) {
          console.error(chalk.red(`Invalid --type "${engagementType}". Valid values: project | retainer | advisory`));
          process.exit(1);
        }
      } else {
        // Interactive mode: prompt for missing values
        p.intro(chalk.bold.hex('#C084FC')('patina client add'));

        if (!name) {
          const result = await p.text({
            message: 'Client name',
            placeholder: 'e.g. Acme Corp',
            validate: (v) => (v.trim() ? undefined : 'Client name is required'),
          });
          if (p.isCancel(result)) {
            p.cancel('Cancelled.');
            process.exit(0);
          }
          name = result as string;
        }

        if (!engagementType) {
          const result = await p.select({
            message: 'Engagement type',
            options: [
              { value: 'project', label: 'Project', hint: 'bounded scope with a defined end date' },
              { value: 'retainer', label: 'Retainer', hint: 'ongoing monthly engagement' },
              { value: 'advisory', label: 'Advisory', hint: 'ongoing advisory or fractional role' },
            ],
          });
          if (p.isCancel(result)) {
            p.cancel('Cancelled.');
            process.exit(0);
          }
          engagementType = result as string;
        } else if (!isEngagementType(engagementType)) {
          console.error(chalk.red(`Invalid --type "${engagementType}". Valid values: project | retainer | advisory`));
          process.exit(1);
        }
      }

      // At this point name and engagementType are guaranteed to be set
      const clientName = name!;
      const clientEngagementType = engagementType! as EngagementType;

      // 5. Guard against overwriting an initialised client folder (checks profile.md so a
      //    partially-created folder from a failed prior run does not block re-running)
      const slug = slugify(clientName);
      const clientDir = join(root, contentDir, 'clients', slug);
      if (existsSync(join(clientDir, 'profile.md'))) {
        console.error(chalk.red(`Client already exists: ${contentDir}/clients/${slug}/profile.md`));
        console.error(chalk.dim('Remove or rename the existing client folder to add a new one with this name.'));
        process.exit(1);
      }

      // 6. Build and write client files
      // contentDir is relative (e.g. 'graph'); buildClientFiles prepends it to paths.
      // writeFileEntry joins path with root, so we pass contentDir as-is.
      const entries = buildClientFiles({
        name: clientName,
        engagementType: clientEngagementType,
        isPrivate,
        today,
        contentDir,
        emitInitialEngagement: true,
      });

      for (const [relativePath, content] of entries) {
        writeFileEntry(root, relativePath, content);
      }

      if (!isHeadless) {
        p.outro(
          chalk.green(`Client folder created: ${contentDir}/clients/${slug}/`) +
          '\n' +
          chalk.dim(`  Edit ${contentDir}/clients/${slug}/profile.md to add relationship context.`),
        );
      } else {
        console.log(chalk.green(`Client folder created: ${contentDir}/clients/${slug}/`));
      }
    });

  program.addCommand(clientCmd);
}
