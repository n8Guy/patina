import { Command } from 'commander';
import { main } from './wizard.js';
import { findPatinaRoot, validate, formatReport } from './validate.js';
import { loadProfile } from './detect.js';
import { registerCommands } from './commands/index.js';
import chalk from 'chalk';

const program = new Command();

// .name() sets help text only — the actual bin is `my-patina` (package.json bin field).
// Hardcoded to 'patina' for brand consistency in help output.
program
  .name('patina')
  .description('Personal professional knowledge graph — setup and management')
  .allowExcessArguments(true);

program
  .command('validate')
  .description('Check your patina for broken links and excluded items')
  .action(() => {
    try {
      const cwd = process.cwd();
      const root = findPatinaRoot(cwd);
      if (root === null) {
        console.error(chalk.red('No patina found here. Run this command from inside a patina directory.'));
        process.exit(1);
      }
      const profile = loadProfile(root);
      const result = validate(root, profile);
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

// Note: registerCommands runs at module load time — all noun-command code is imported
// eagerly regardless of which subcommand the user invokes. Acceptable for this project's
// current size; revisit if startup latency becomes a concern.
registerCommands(program);

// Default: run wizard when no subcommand given; error on unrecognized commands.
program.action(function (this: Command) {
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
