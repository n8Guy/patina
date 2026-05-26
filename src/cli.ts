import { main } from './wizard.js';
import { findPatinaRoot, validate, formatReport } from './validate.js';
import { loadProfile } from './detect.js';
import chalk from 'chalk';

const [cmd] = process.argv.slice(2);

if (cmd === 'validate') {
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
    const summary = lines.pop()!;
    if (lines.length > 0) console.log(lines.join('\n'));
    console.log(result.ok ? chalk.green(summary) : chalk.red(summary));
    process.exit(result.ok ? 0 : 1);
  } catch (err) {
    console.error(chalk.red(err instanceof Error ? err.message : String(err)));
    process.exit(1);
  }
} else {
  main().catch((err: Error) => {
    console.error(err.message);
    process.exit(1);
  });
}
