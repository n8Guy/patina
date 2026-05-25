export function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    return key in vars ? vars[key] : `{{${key}}}`;
  });
}
