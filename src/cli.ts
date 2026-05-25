import { main } from './wizard.js';

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
