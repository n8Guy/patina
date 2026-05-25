import { cpSync } from 'fs';

cpSync('src/templates', 'dist/templates', { recursive: true });
console.log('Templates copied to dist/templates');
