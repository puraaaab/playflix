import fs from 'node:fs';
import https from 'node:https';
import http from 'node:http';
import next from 'next';

const dev = process.env.NODE_ENV !== 'production';
const cliHostIndex = process.argv.indexOf('--host');
const cliHostValue = cliHostIndex >= 0 ? process.argv[cliHostIndex + 1] : '';
const hostname = process.env.HOST || process.env.HOSTNAME || cliHostValue || '0.0.0.0';
const port = Number.parseInt(process.env.PORT || '3000', 10);
const keyPath = process.env.SSL_KEY_PATH || 'certs/localhost-key.pem';
const certPath = process.env.SSL_CERT_PATH || 'certs/localhost-cert.pem';
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

async function start() {
  await app.prepare();

  if (keyPath && certPath && fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    https.createServer({ key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) }, (req, res) => {
      handle(req, res);
    }).listen(port, () => {
      console.log(`PlayFlix frontend listening on https://${hostname}:${port}`);
    });
    return;
  }

  http.createServer((req, res) => {
    handle(req, res);
  }).listen(port, () => {
    console.warn(`PlayFlix frontend started on http://${hostname}:${port}. HTTPS certs were not found.`);
  });
}

start();
