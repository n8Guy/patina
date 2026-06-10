#!/usr/bin/env node
'use strict';
const major = parseInt(process.versions.node.split('.')[0], 10);
if (major < 22) {
  process.stderr.write(
    'patina needs Node 22 or newer — you have ' + process.versions.node + '. Download it at https://nodejs.org\n'
  );
  process.exit(1);
}
import('./cli.js').catch(function (err) {
  process.stderr.write(String(err) + '\n');
  process.exit(1);
});
