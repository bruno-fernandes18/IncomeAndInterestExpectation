import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import express from 'express';
import { createSimulationHandler } from './server/routes/simulate.js';

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '10kb' }));
  app.use('/core', express.static(path.join(PROJECT_ROOT, 'shared')));
  app.use(express.static(path.join(PROJECT_ROOT, 'public')));
  app.post('/api/simulate', createSimulationHandler());
  return app;
}

export function getLanAddresses() {
  const addresses = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (!entry.internal && (entry.family === 'IPv4' || entry.family === 4)) {
        addresses.push(entry.address);
      }
    }
  }
  return [...new Set(addresses)];
}

export function startServer({ port = Number(process.env.PORT) || 3000, host = process.env.HOST || '0.0.0.0' } = {}) {
  const app = createApp();
  const server = app.listen(port, host, () => {
    const actualPort = server.address().port;
    console.log(`Simulator available at http://localhost:${actualPort}`);
    for (const address of getLanAddresses()) {
      console.log(`Local network access: http://${address}:${actualPort}`);
    }
  });
  return server;
}

const isMainModule = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMainModule) startServer();
