import { createHash } from 'node:crypto';
import path from 'node:path';
import { realpath } from 'node:fs/promises';

export function identity(payload) {
  if (!payload || (payload.code !== undefined && payload.code !== 0)) throw new Error('VOS rejected identity');
  const claims = payload.data || payload;
  const subject = String(claims.sub || claims.id || '').trim();
  if (!subject) throw new Error('VOS identity has no subject');
  return { subject, namespace: createHash('sha256').update(`v-sub\0${subject}`).digest('hex'), username: String(claims.preferred_username || claims.username || claims.name || subject) };
}
export function confined(root, target) {
  const absolute = path.resolve(target);
  if (absolute !== root && !absolute.startsWith(root + path.sep)) throw new Error('File is outside this user workspace');
  return absolute;
}
export async function existingFile(root, target) {
  return confined(await realpath(root), await realpath(confined(root, target)));
}
export function sameOrigin(req) {
  if (!req.headers.origin) return req.headers['sec-fetch-site'] !== 'cross-site';
  try { return new URL(req.headers.origin).host === (req.headers['x-forwarded-host'] || req.headers.host); } catch { return false; }
}
export function modelCapabilities(row) {
  const caps = row.capabilities || [];
  const endpoints = row.endpoints || [];
  const declared = caps.some(c => ['asr', 'transcription', 'transcriptions', 'tts', 'speech', 'chat', 'embedding', 'image_generation', 'images', 'video_generation', 'music', 'rerank', 'moderation'].includes(c));
  const unknown = (!row.kind || row.kind === 'unknown') && !declared && endpoints.length === 0;
  return { asr: unknown || row.kind === 'asr' || caps.some(c => ['asr', 'transcription', 'transcriptions'].includes(c)) || endpoints.some(e => e.replace(/^\/?v1\//, '').replace(/^\//, '') === 'audio/transcriptions'), tts: unknown || row.kind === 'tts' || caps.some(c => ['tts', 'speech'].includes(c)) || endpoints.some(e => e.replace(/^\/?v1\//, '').replace(/^\//, '') === 'audio/speech') };
}
