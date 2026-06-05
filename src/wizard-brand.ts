import chalk from 'chalk';

// ─── Brand ───────────────────────────────────────────────────────────────────

export function printBanner(): void {
  const colors = ['#FF6B6B', '#FF8C42', '#FFAB2E', '#C084FC', '#818CF8', '#60A5FA'];
  const art = [
    ' ██████╗  █████╗ ████████╗██╗███╗  ██╗ █████╗ ',
    ' ██╔══██╗██╔══██╗╚══██╔══╝██║████╗ ██║██╔══██╗',
    ' ██████╔╝███████║   ██║   ██║██╔██╗██║███████║',
    ' ██╔═══╝ ██╔══██║   ██║   ██║██║╚████║██╔══██║',
    ' ██║     ██║  ██║   ██║   ██║██║ ╚███║██║  ██║',
    ' ╚═╝     ╚═╝  ╚═╝   ╚═╝   ╚═╝╚═╝  ╚══╝╚═╝  ╚═╝',
  ];

  console.log('');
  console.log(chalk.bold.white('  Welcome to'));
  art.forEach((line, i) => {
    console.log(chalk.bold.hex(colors[i % colors.length])(line));
  });
  console.log('');
}

export function privacyNote(): string {
  return [
    chalk.bold.hex('#60A5FA')('All your data lives in a folder on YOUR machine'),
    chalk.white('patina never sends your data anywhere - what you do with your data is your business'),
  ].join('\n');
}

export function label(text: string): string {
  return chalk.bold.hex('#C084FC')(text);
}
