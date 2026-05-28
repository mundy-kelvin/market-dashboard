import { readFileSync, writeFileSync, existsSync } from 'fs';

const key = process.env['FINNHUB_API_KEY'] ?? '';
if (!key) {
  console.warn('[set-env] FINNHUB_API_KEY is not set — WebSocket and REST features will not work.');
}

// Angular requires environment.ts to exist as the import source even in production
// builds where fileReplacements swaps it for environment.prod.ts.
const devEnvPath = 'src/environments/environment.ts';
if (!existsSync(devEnvPath)) {
  writeFileSync(devEnvPath, `export const environment = {
  production: false,
  finnhubApiKey: '',
  finnhubWsUrl: 'wss://ws.finnhub.io',
  finnhubRestUrl: 'https://finnhub.io/api/v1',
  yahooFinanceUrl: '/api/chart',
};\n`);
  console.log('[set-env] environment.ts stub created.');
}

// Inject API key into the production environment file.
const prodEnvPath = 'src/environments/environment.prod.ts';
const updated = readFileSync(prodEnvPath, 'utf8').replace(
  "finnhubApiKey: ''",
  `finnhubApiKey: '${key}'`,
);
writeFileSync(prodEnvPath, updated);
console.log('[set-env] environment.prod.ts updated.');
