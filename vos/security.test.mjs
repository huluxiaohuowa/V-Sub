import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { identity, confined, existingFile, sameOrigin, modelCapabilities } from './security.mjs';
test('identity uses verified immutable subject and rejects failed responses', () => {
  assert.equal(identity({ sub: 'a', name: 'one' }).namespace, identity({ data: { sub: 'a', name: 'two' }, code: 0 }).namespace);
  assert.notEqual(identity({ sub: 'a' }).namespace, identity({ sub: 'b' }).namespace);
  assert.throws(() => identity({ code: 1, data: { sub: 'a' } }));
  assert.throws(() => identity({ username: 'a' }));
});
test('file boundaries reject traversal, sibling namespaces and symlink escapes', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'v-sub-test-'));
  const user = path.join(root, 'user'); await mkdir(user); await writeFile(path.join(user, 'audio.wav'), 'audio'); await writeFile(path.join(root, 'private'), 'private');
  assert.equal(await existingFile(user, path.join(user, 'audio.wav')), path.join(user, 'audio.wav'));
  assert.throws(() => confined(user, path.join(user, '../private')));
  assert.throws(() => confined(user, user + '-other/audio.wav'));
  await symlink(path.join(root, 'private'), path.join(user, 'link'));
  await assert.rejects(existingFile(user, path.join(user, 'link')));
});
test('mutating cross-origin requests are rejected', () => {
  assert.equal(sameOrigin({ headers: { host: 'vos:1182', origin: 'http://vos:1182' } }), true);
  assert.equal(sameOrigin({ headers: { host: 'vos:1182', origin: 'https://other' } }), false);
  assert.equal(sameOrigin({ headers: { host: 'vos:1182', 'sec-fetch-site': 'cross-site' } }), false);
});
test('ASR/TTS are selected by capability, never guessed from model name', () => {
  assert.deepEqual(modelCapabilities({ id: 'tts-named-chat', capabilities: ['chat'] }), { asr: false, tts: false });
  assert.deepEqual(modelCapabilities({ endpoints: ['/v1/audio/transcriptions', 'audio/speech'] }), { asr: true, tts: true });
});

test('standard cloud models without capability metadata remain selectable', () => {
  assert.deepEqual(modelCapabilities({ kind: 'unknown', id: 'whisper-1' }), { asr: true, tts: true });
  assert.deepEqual(modelCapabilities({ capabilities: ['speech'] }), { asr: false, tts: true });
});
