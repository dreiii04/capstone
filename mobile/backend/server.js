import {
  app,
  initializeBackend,
} from './app.js';

import config from './components/config/config.js';

try {
  if (config.startupError) {
    throw new Error(
      config.startupError,
    );
  }

  await initializeBackend();

  app.listen(
    config.port,
    '0.0.0.0',
    () => {
      console.log(
        `Auth API listening on port ${config.port}`,
      );
    },
  );
} catch (error) {
  console.error(
    `Failed to start server: ${error.message}`,
  );

  process.exitCode = 1;
}