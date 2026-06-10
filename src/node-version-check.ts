export function nodeVersionMessage(nodeVersion: string): string | null {
  const major = parseInt(nodeVersion.split('.')[0], 10);
  if (major < 22) {
    return `patina needs Node 22 or newer — you have ${nodeVersion}. Download it at https://nodejs.org`;
  }
  return null;
}
