import { Command } from 'commander';
import * as p from '@clack/prompts';
import { main } from './wizard.js';
import { findPatinaRoot, validate, formatReport, formatReportJson } from './validate.js';
import { loadProfile } from './detect.js';
import { runDemo } from './demo/index.js';
import { detectCorruption, repairCorruption, formatHealthReport } from './health.js';
import chalk from 'chalk';

const program = new Command();

// .name() sets help text only — the actual bin is `my-patina` (package.json bin field).
// Hardcoded to 'patina' for brand consistency in help output.
program
  .name('patina')
  .description('Personal professional knowledge graph — setup and management')
  .allowExcessArguments(true)
  .option('--demo', 'scaffold a demo patina with a fictional persona into patina-demo/');

program
  .command('validate')
  .description('Check your patina for broken links and excluded items')
  .option('--json', 'output results as JSON')
  .action((opts: { json?: boolean }) => {
    try {
      const cwd = process.cwd();
      const root = findPatinaRoot(cwd);
      if (root === null) {
        if (opts.json) {
          process.stdout.write(JSON.stringify({ ok: false, error: 'not a patina directory', issues: [], filesChecked: 0 }) + '\n');
          process.exit(1);
        }
        console.error(chalk.red('No patina found here. Run this command from inside a patina directory.'));
        process.exit(1);
      }
      const profile = loadProfile(root);
      const result = validate(root, profile);
      if (opts.json) {
        process.stdout.write(formatReportJson(result));
        process.exit(result.ok ? 0 : 1);
      }
      const report = formatReport(result);
      const lines = report.split('\n');
      const summary = lines.pop() ?? '';
      if (lines.length > 0) console.log(lines.join('\n'));
      console.log(result.ok ? chalk.green(summary) : chalk.red(summary));
      process.exit(result.ok ? 0 : 1);
    } catch (err) {
      console.error(chalk.red(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }
  });

program
  .command('repair')
  .description('Detect and repair corrupted managed files')
  .option('--dry-run', 'report problems without writing any changes')
  .action(async (opts: { dryRun?: boolean }) => {
    try {
      const cwd = process.cwd();
      const root = findPatinaRoot(cwd);
      if (root === null) {
        console.error(chalk.red('No patina found here. Run this command from inside a patina directory.'));
        process.exit(1);
      }
      const profile = loadProfile(root);

      if (opts.dryRun) {
        const report = detectCorruption(root, profile);
        const formatted = formatHealthReport(report);
        // Split off the last line as summary (like validate does)
        const lines = formatted.split('\n');
        const summary = lines.pop() ?? '';
        if (lines.length > 0) console.log(lines.join('\n'));
        console.log(report.ok ? chalk.green(summary) : chalk.red(summary));
        // Exit non-zero only on managed-file findings (placeholders/missing-sections),
        // not on orphaned-checksum-only findings
        const managedFindings = report.findings.filter(
          f => f.kind === 'placeholders' || f.kind === 'missing-section'
        );
        process.exit(managedFindings.length > 0 ? 1 : 0);
      } else {
        // Interactive repair: detect first, show preview, ask for confirmation
        const preReport = detectCorruption(root, profile);
        if (preReport.ok) {
          console.log(chalk.green('No corruption found.'));
          process.exit(0);
        }

        // Show preview of what will change
        console.log(chalk.yellow('Corruption detected:'));
        console.log(formatHealthReport(preReport));
        console.log('');

        const proceed = await p.confirm({
          message: 'Repair these files? Your graph/ content will not be touched.',
        });
        if (p.isCancel(proceed) || !proceed) {
          console.log('Aborted.');
          process.exit(0);
        }

        const { report, repairedFiles } = await repairCorruption(root, profile, { dryRun: false });
        if (repairedFiles.length > 0) {
          console.log(chalk.green(`Repaired: ${repairedFiles.join(', ')}`));
          console.log(chalk.hex('#94A3B8')('Your notes and settings in graph/ were not changed.'));
          if (!report.ok) {
            console.log(chalk.yellow('Warning: some issues could not be automatically repaired:'));
            console.log(formatHealthReport(report));
          }
        } else {
          // Only orphaned checksums — report them (already pruned by repairCorruption)
          console.log(chalk.hex('#94A3B8')('Orphaned checksum entries pruned from .patina-state.json.'));
        }
      }
    } catch (err) {
      console.error(chalk.red(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }
  });

// Default: run wizard when no subcommand given; error on unrecognized commands.
program.action(function (this: Command) {
  const opts = this.opts<{ demo?: boolean }>();
  if (opts.demo) {
    runDemo(process.cwd()).catch((err: Error) => {
      console.error(chalk.red(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    });
    return;
  }
  if (this.args.length > 0) {
    console.error(chalk.red(`Unknown command: ${this.args[0]}`));
    console.error(chalk.dim("Run 'patina --help' for available commands."));
    process.exit(1);
  }
  main().catch((err: Error) => {
    console.error(err.message);
    process.exit(1);
  });
});

program.parseAsync(process.argv).catch((err: Error) => {
  console.error(chalk.red(err instanceof Error ? err.message : String(err)));
  process.exit(1);
});
