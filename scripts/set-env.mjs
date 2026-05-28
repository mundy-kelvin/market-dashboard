import { readFileSync, writeFileSync } from 'fs';

const key = process.env['FINNHUB_API_KEY'] ?? '';
if (!key) {
  console.warn('[set-env] FINNHUB_API_KEY is not set — WebSocket and REST features will not work.');
}

const path = 'src/environments/environment.prod.ts';
const updated = readFileSync(path, 'utf8').replace(
  "finnhubApiKey: ''",
  `finnhubApiKey: '${key}'`,
);
writeFileSync(path, updated);
console.log('[set-env] environment.prod.ts updated.');
