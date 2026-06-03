/**
 * In demo mode, inserts `_demo: true` as the first line inside a leading `---` frontmatter block.
 * Returns content unchanged if no frontmatter is found.
 *
 * Preserves the line ending style of the opening delimiter (LF or CRLF).
 */
export function markDemo(content: string): string {
  return content.replace(/^(---\r?\n)/, (_, delim: string) => {
    const nl = delim.endsWith('\r\n') ? '\r\n' : '\n';
    return delim + '_demo: true' + nl;
  });
}
