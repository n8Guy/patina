import type { Command } from 'commander';

// Register all noun-group subcommands (e.g. patina client add).
// Each noun module creates a Command and adds its verbs, then calls program.addCommand().
//
// When adding the first noun command, change the import above from `import type` to
// `import { Command } from 'commander'` so `new Command(...)` is available as a value.
//
// Example (issue #30):
//   const clientCmd = new Command('client').description('Manage clients');
//   clientCmd.command('add').description('Add a client').action(() => { ... });
//   program.addCommand(clientCmd);
export function registerCommands(_program: Command): void {
  // noun-verb commands registered here as they are added
}
