import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const env = { ...process.env, VSUB_WEB: '1', NEXT_PUBLIC_VSUB_WEB: '1', CI: '1', NEXT_TELEMETRY_DISABLED: '1' };
execFileSync('node', ['node_modules/typescript/bin/tsc', '--noEmit', '--incremental', 'false', '-p', 'main/tsconfig.json'], { stdio: 'inherit', env });
execFileSync('node', ['scripts/vos-locales.cjs'], { stdio: 'inherit', env });
execFileSync('node', ['node_modules/next/dist/bin/next', 'build', 'renderer'], { stdio: 'inherit', env });
if (fs.existsSync('renderer/out')) {
  fs.rmSync('app', { recursive: true, force: true });
  fs.cpSync('renderer/out', 'app', { recursive: true });
}
if (!fs.existsSync('app/zh/home/index.html')) throw new Error('Next static export is missing the VOS entry page');
execFileSync('node', ['scripts/build-automation-backend.cjs'], { stdio: 'inherit', env });
// Build utility-process workers with the same paths as the desktop package.
execFileSync('node', ['scripts/build-automation.mjs'], { stdio: 'inherit', env });
for (const file of ['vos/gateway.mjs', 'vos/security.mjs']) if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);
