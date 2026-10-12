/* The VOS browser transport implements the existing preload contract. */
(() => {
  const base = '/app/com.ictrek.v-sub';
  const handlers = new Map(), paths = new WeakMap();
  const clientId = Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2, '0')).join('');
  let ready, renew, renewal, userNamespace = '', unsaved = false;
  const applyUser = user => {
    if (userNamespace && userNamespace !== user.namespace) { window.location.reload(); throw new Error('VOS account changed'); }
    userNamespace = user.namespace;
  };
  const decode = value => {
    if (value && value.__bytes) return Uint8Array.from(value.__bytes);
    if (Array.isArray(value)) return value.map(decode);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, decode(v)]));
    return value;
  };
  const dispatch = (channel, ...args) => { for (const callback of handlers.get(channel) || []) callback(...args.map(decode)); };
  async function api(route, value) {
    const response = await fetch(base + route, { credentials: 'same-origin', ...(value === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) }) });
    if (response.status === 401 && !route.startsWith('/api/auth/') && renew) {
      await (renewal ||= renew().finally(() => { renewal = null; }));
      const retry = await fetch(base + route, { credentials: 'same-origin', ...(value === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) }) });
      const result = await retry.json(); if (!retry.ok) throw new Error(result.error || 'VOS request failed'); return result;
    }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'VOS request failed');
    return result;
  }
  async function upload(file) {
    if (paths.has(file)) return paths.get(file);
    const response = await fetch(`${base}/api/upload?name=${encodeURIComponent(file.name)}`, { method: 'POST', credentials: 'same-origin', body: file });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Upload failed');
    paths.set(file, result.path); return result.path;
  }
  function download(file) {
    const link = document.createElement('a'); link.href = `${base}/media?path=${encodeURIComponent(file)}&download=1`; link.download = file.split('/').pop(); link.click();
  }
  async function pick(options) {
    return new Promise(resolve => {
      const input = document.createElement('input'); input.type = 'file'; input.multiple = !!options.multiple;
      if (options.filters) input.accept = options.filters.flatMap(f => f.extensions || []).filter(e => e !== '*').map(e => '.' + e).join(',');
      input.onchange = async () => { try { resolve(await Promise.all(Array.from(input.files || []).map(upload))); } catch (error) { dispatch('vos:error', error.message); resolve([]); } };
      input.oncancel = () => resolve([]); input.click();
    });
  }
  async function ipc(channel, args, mode) {
    await ready;
    const value = await api('/api/ipc', { channel, args, mode, clientId });
    for (const file of value.downloads || []) download(file);
    return decode(value.result);
  }
  window.ipc = {
    vos: true, platform: 'linux',
    invoke: (channel, ...args) => ipc(channel, args, 'invoke'),
    send: (channel, value) => { if (channel === 'setUnsavedChanges') { unsaved = value === true; return; } void ipc(channel, [value], 'send').catch(error => dispatch('vos:error', error.message)); },
    on(channel, callback) { if (!handlers.has(channel)) handlers.set(channel, new Set()); handlers.get(channel).add(callback); return () => handlers.get(channel)?.delete(callback); },
    getPathForFile: file => paths.get(file) || '',
    proofreadDraft: {
      read(key) { try { return { success: true, raw: localStorage.getItem('v-sub:draft:' + userNamespace + ':' + key) }; } catch { return { success: false, error: 'Storage unavailable' }; } },
      write(key, raw) { try { if (raw === null) localStorage.removeItem('v-sub:draft:' + userNamespace + ':' + key); else localStorage.setItem('v-sub:draft:' + userNamespace + ':' + key, raw); return { success: true, raw }; } catch { return { success: false, error: 'Storage unavailable' }; } },
    },
  };
  renew = async () => {
    const config = await api('/api/auth/session').catch(() => ({ clientId: 'com.ictrek.v-sub' }));
    let oauth;
    for (let n = 0; n < 100; n++) { oauth = window.vos_platform?.api?.v1000?.oauth2; if (oauth || window.parent === window) break; await new Promise(resolve => setTimeout(resolve, 50)); }
    if (oauth) {
      const { verifier, state, nonce, challenge } = await api('/api/auth/pkce');
      const auth = await oauth.authorize({ client_id: config.clientId, response_type: 'code', scope: 'openid profile email', state, nonce, code_challenge: challenge, code_challenge_method: 'S256' });
      if (auth.state !== state) throw new Error('VOS OIDC state mismatch');
      const tokens = await oauth.token({ grant_type: 'authorization_code', code: auth.code, code_verifier: verifier, client_id: config.clientId });
      const result = await api('/api/auth/vos-oidc', { access_token: tokens.access_token });
      applyUser(result.user);
    } else if (!config.authenticated) throw new Error('Open V-Sub from VOS to sign in');
    else applyUser(config.user);
  };
  ready = (async () => {
    await renew();
    const events = new EventSource(base + '/api/events?clientId=' + clientId);
    events.onmessage = async event => {
      const { channel, args } = JSON.parse(event.data);
      if (channel === 'vos:dialog') { const options = args[0]; await api('/api/dialog', { id: options.id, paths: await pick(options) }); }
      else if (channel === 'vos:download') download(args[0]);
      else if (channel === 'vos:open-url') window.open(args[0], '_blank', 'noopener');
      else dispatch(channel, ...args);
    };
  })();
  ready.catch(error => { window.dispatchEvent(new CustomEvent('v-sub-auth-error', { detail: error.message })); });
  window.addEventListener('beforeunload', event => { if (unsaved) { event.preventDefault(); event.returnValue = ''; } });
  window.addEventListener('focus', () => { void ready.then(() => renew()).catch(error => dispatch('vos:error', error.message)); });
  window.addEventListener('pagehide', () => navigator.sendBeacon(base + '/api/close', JSON.stringify({ clientId })));
  // Upload dropped files before the existing synchronous desktop drop handlers read their paths.
  document.addEventListener('drop', async event => {
    if (!event.dataTransfer?.files.length || Array.from(event.dataTransfer.files).every(file => paths.has(file))) return;
    event.preventDefault(); event.stopImmediatePropagation();
    try { await ready; await Promise.all(Array.from(event.dataTransfer.files).map(upload)); event.target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: event.dataTransfer })); }
    catch (error) { dispatch('vos:error', error.message); }
  }, true);
})();
