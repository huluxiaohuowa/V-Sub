import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
function download(url, target) {
  for (const prefix of ['https://ghfast.top/', 'https://gh-proxy.com/', '']) {
    try {
      execFileSync('curl', ['-fsSL', '--connect-timeout', '10', '--max-time', '600', '--retry', '1', prefix + url, '-o', target], { stdio: 'inherit' });
      return;
    } catch {}
  }
  throw new Error('Cannot download pinned native source: ' + url);
}
if (process.arch === 'x64') execFileSync('node', ['scripts/fetch-whisper-addon.mjs'], { stdio: 'inherit' });
else {
  const root = process.env.VSUB_NATIVE_BUILD_ROOT || '/tmp/v-sub-whisper';
  fs.mkdirSync(root, { recursive: true });
  download('https://github.com/ggml-org/whisper.cpp/archive/refs/tags/v1.9.5.tar.gz', root + '/source.tar.gz');
  execFileSync('tar', ['xf', root + '/source.tar.gz', '--strip-components=1', '-C', root]);
  for (const name of ['0001-addon.node-cancel-via-AbortSignal.patch', '0002-addon.node-emit-tokens-and-vad-segments.patch']) {
    const patchFile = path.join(root, name);
    download(`https://raw.githubusercontent.com/buxuku/whisper.cpp/9c38c27391111bdf4e80355e14a3460ef13152d2/.github/upstream/patches/${name}`, patchFile);
    execFileSync('patch', ['-p1', '-i', patchFile], { cwd: root, stdio: 'inherit' });
  }
  execFileSync('npm', ['install', '--ignore-scripts', '--registry=https://registry.npmmirror.com'], { cwd: root + '/examples/addon.node', stdio: 'inherit' });
  execFileSync('cmake', ['-S', root, '-B', root + '/build', '-DCMAKE_JS_VERSION=7.1.1', '-DWHISPER_STATIC=ON', '-DWHISPER_BUILD_TESTS=OFF', '-DGGML_NATIVE=OFF', '-DBUILD_SHARED_LIBS=OFF', '-DCMAKE_POSITION_INDEPENDENT_CODE=ON', '-DCMAKE_JS_INC=/usr/local/include/node'], { stdio: 'inherit' });
  execFileSync('cmake', ['--build', root + '/build', '--target', 'addon.node', '-j', '4'], { stdio: 'inherit' });
  fs.mkdirSync('extraResources/addons', { recursive: true });
  const find = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(e => e.isDirectory() ? find(path.join(directory, e.name)) : e.name === 'addon.node' ? [path.join(directory, e.name)] : []);
  const addon = find(root + '/build')[0]; if (!addon) throw new Error('ARM whisper addon build produced no addon.node');
  fs.copyFileSync(addon, 'extraResources/addons/addon.node');
}
