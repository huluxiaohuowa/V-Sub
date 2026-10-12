// Controlled OIDC and standard audio upstream for isolated integration tests only.
import http from 'node:http';
const json = (res, code, value) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
const voiceURL = process.env.VSUB_TEST_VOICE_URL || 'http://127.0.0.1:22700';
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (url.pathname === '/v1000/oauth2/userinfo') {
      if (!['vsub-test-a', 'vsub-test-b'].includes(token)) { json(res, 401, { error: 'Invalid test token' }); return; }
      json(res, 200, { sub: token.slice(-1), preferred_username: `test-${token.slice(-1)}`, roles: ['user'] }); return;
    }
    if (url.pathname === '/v1/models') { json(res, 200, { data: [{ id: 'standard-asr', object: 'model' }, { id: 'standard-tts', object: 'model' }] }); return; }
    if (url.pathname === '/v1/audio/voices') {
      const response = await fetch(`${voiceURL}/v1/audio/voices?model=kokoro-multilang`);
      res.writeHead(response.status, { 'Content-Type': 'application/json' }); res.end(Buffer.from(await response.arrayBuffer())); return;
    }
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const data = Buffer.concat(chunks);
    if (url.pathname === '/v1/audio/transcriptions') {
      const form = await new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': req.headers['content-type'] }, body: data }).formData();
      form.set('model', 'sensevoice-int8');
      const response = await fetch(`${voiceURL}/v1/audio/transcriptions`, { method: 'POST', body: form });
      res.writeHead(response.status, { 'Content-Type': response.headers.get('content-type') }); res.end(Buffer.from(await response.arrayBuffer())); return;
    }
    if (url.pathname === '/v1/audio/speech') {
      const value = JSON.parse(data); value.model = 'kokoro-multilang';
      if (['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'].includes(value.voice)) { const catalog = await (await fetch(`${voiceURL}/v1/audio/voices?model=kokoro-multilang`)).json(); value.voice = catalog.default_voice || catalog.voices[0].id; }
      const response = await fetch(`${voiceURL}/v1/audio/speech`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
      res.writeHead(response.status, { 'Content-Type': response.headers.get('content-type') }); res.end(Buffer.from(await response.arrayBuffer())); return;
    }
    json(res, 404, { error: 'Unknown test service endpoint' });
  } catch (e) { json(res, 500, { error: e.message }); }
});
server.listen(Number(process.env.PORT || 28090), '0.0.0.0');
