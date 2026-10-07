import { startApplication, installProcessHandlers } from './app.js';

try {
  const app = await startApplication();
  installProcessHandlers(app.logger, app.shutdown);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`❌ ${message}\n`);
  process.exitCode = 1;
}
