import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const platform = `linux-${process.arch}`;
const name = `smartsub-sherpa-onnx-${platform}-1.13.2.tar.gz`;
const directory = path.join(os.tmpdir(), 'v-sub-sherpa'); fs.mkdirSync(directory, { recursive: true });
const file = path.join(directory, name);
const url = `https://github.com/buxuku/smartsub-py-engine/releases/download/sherpa-libs-latest/${name}`;
function download(suffix, destination) {
  for (const origin of ['https://ghfast.top/', 'https://gh-proxy.com/', '']) {
    try { execFileSync('curl', ['-fsSL', '--connect-timeout', '10', '--max-time', '600', '--retry', '1', origin + url + suffix, '-o', destination], { stdio: 'inherit' }); return; } catch {}
  }
  throw new Error('Could not download sherpa-onnx native library');
}
download('', file); download('.sha256', file + '.sha256');
const expected = fs.readFileSync(file + '.sha256', 'utf8').match(/^[a-f0-9]{64}/i)?.[0];
const actual = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
if (!expected || expected.toLowerCase() !== actual) throw new Error('Sherpa native checksum mismatch');
const out = `extraResources/sherpa/native/${platform}`; fs.mkdirSync(out, { recursive: true });
execFileSync('tar', ['xf', file, '-C', out]);
if (!fs.existsSync(out + '/sherpa-onnx.node')) throw new Error('Missing sherpa-onnx.node');
console.log('Verified sherpa-onnx native library', platform);
