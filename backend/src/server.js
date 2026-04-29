import fs from 'node:fs';
import https from 'node:https';
import http from 'node:http';
import { createApp } from './app.js';
import { initializeDatabase } from './config/db.js';
import { env } from './config/env.js';

const hostname = process.env.HOST || process.env.HOSTNAME || '0.0.0.0';

async function start() {
  await initializeDatabase();

  const app = createApp();

  if (env.sslKeyPath && env.sslCertPath && fs.existsSync(env.sslKeyPath) && fs.existsSync(env.sslCertPath)) {
    const options = {
      key: fs.readFileSync(env.sslKeyPath),
      cert: fs.readFileSync(env.sslCertPath)
    };

    https.createServer(options, app).listen(env.port, () => {
      console.log(`PlayFlix API listening on https://${hostname}:${env.port}`);
    });
    return;
  }

  http.createServer(app).listen(env.port, hostname, () => {
    console.warn(`PlayFlix API started on http://${hostname}:${env.port}. HTTPS certs were not found.`);
  });
}

start().catch((error) => {
  console.error('[playflix] Failed to start API:', error);
  process.exit(1);
});
