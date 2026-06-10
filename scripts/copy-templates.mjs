import { cpSync, copyFileSync } from 'fs';

cpSync('src/templates', 'dist/templates', { recursive: true });
console.log('Templates copied to dist/templates');

copyFileSync('src/check-node.cjs', 'dist/check-node.cjs');
console.log('check-node.cjs copied to dist/');
