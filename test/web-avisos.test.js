import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { estadoAvisos, ehIos, versaoIos, iosAntigo, textoRegra, base64urlParaBytes, chavesIguais, urlSegura } from '../web/js/avisos-estado.js';

const base = { seguro: true, ios: false, standalone: false, temPush: true, avisosLigados: true, permissao: 'default', inscrito: false };
const est = (o) => estadoAvisos({ ...base, ...o });

test('estadoAvisos: ordem das regras', () => {
  assert.equal(est({ seguro: false, ios: true }), 'indisponivel');
  assert.equal(est({ ios: true, standalone: false, temPush: false }), 'instalar');
  assert.equal(est({ ios: true, standalone: true, temPush: false }), 'sem-suporte');
  assert.equal(est({ temPush: false }), 'sem-suporte');
  assert.equal(est({ avisosLigados: false }), 'desligado-pc');
  assert.equal(est({ permissao: 'denied', inscrito: true }), 'bloqueado');
  assert.equal(est({ permissao: 'granted', inscrito: true }), 'ativo');
  assert.equal(est({ permissao: 'granted', inscrito: false }), 'pronto');
  assert.equal(est({}), 'pronto');
});

test('iPad que se diz Mac conta como iOS; Mac sem toque não', () => {
  assert.equal(ehIos({ userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 5 }), true);
  assert.equal(ehIos({ userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 0 }), false);
  assert.equal(ehIos({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X)' }), true);
  assert.equal(ehIos({ userAgent: 'Mozilla/5.0 (Linux; Android 14)', platform: 'Linux armv8l', maxTouchPoints: 5 }), false);
  assert.equal(est({ ios: ehIos({ platform: 'MacIntel', maxTouchPoints: 5 }), standalone: false }), 'instalar');
});

test('versão do iOS e dica de versão antiga', () => {
  assert.equal(versaoIos('Mozilla/5.0 (iPhone; CPU iPhone OS 16_3 like Mac OS X)'), 16.03);
  assert.equal(iosAntigo({ ios: true, iosVersao: versaoIos('CPU iPhone OS 16_3 like') }), true);
  assert.equal(iosAntigo({ ios: true, iosVersao: versaoIos('CPU iPhone OS 16_4 like') }), false);
  assert.equal(iosAntigo({ ios: true, iosVersao: versaoIos('CPU iPhone OS 17_0 like') }), false);
  assert.equal(iosAntigo({ ios: true, iosVersao: null }), false);
  assert.equal(iosAntigo({ ios: false, iosVersao: 15 }), false);
  // iOS instalado e antigo: sem PushManager cai em sem-suporte
  assert.equal(est({ ios: true, standalone: true, temPush: false }), 'sem-suporte');
});

test('textoRegra', () => {
  assert.equal(textoRegra({ avisoSomSegundos: 20, avisoIntervaloMinutos: 10 }), 'Avisa quando houver som por 20 s seguidos, no máximo 1 aviso a cada 10 min.');
  assert.equal(textoRegra({ avisoSomSegundos: 30, avisoIntervaloMinutos: 5, avisoSilencioInicio: '', avisoSilencioFim: '' }), 'Avisa quando houver som por 30 s seguidos, no máximo 1 aviso a cada 5 min.');
  assert.match(textoRegra({ avisoSomSegundos: 20, avisoIntervaloMinutos: 10, avisoSilencioInicio: '23:00', avisoSilencioFim: '07:00' }), / Em silêncio das 23h às 7h\.$/);
  assert.match(textoRegra({ avisoSomSegundos: 20, avisoIntervaloMinutos: 10, avisoSilencioInicio: '23:30', avisoSilencioFim: '06:15' }), / Em silêncio das 23h30 às 6h15\.$/);
});

test('base64url para bytes e comparação de chaves', () => {
  assert.deepEqual([...base64urlParaBytes('AQID')], [1, 2, 3]);
  assert.deepEqual([...base64urlParaBytes('-_8')], [251, 255]);
  const bytes = new Uint8Array([4, 250, 255, 7]);
  const b64u = Buffer.from(bytes).toString('base64url');
  assert.equal(chavesIguais(bytes.buffer, b64u), true);
  assert.equal(chavesIguais(bytes, b64u), true);
  assert.equal(chavesIguais(new Uint8Array([4, 250, 255, 8]).buffer, b64u), false);
  assert.equal(chavesIguais(new Uint8Array([4, 250]).buffer, b64u), false);
  assert.equal(chavesIguais(null, b64u), false);
});

test('urlSegura', () => {
  assert.equal(urlSegura('/ver?a=1'), '/ver?a=1');
  assert.equal(urlSegura('https://x.com/'), '/');
  assert.equal(urlSegura('//x.com'), '/');
  assert.equal(urlSegura(undefined), '/');
});

test('manifest tem os campos exigidos', () => {
  const m = JSON.parse(readFileSync(new URL('../web/manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(m.name, 'Rocky · monitor');
  assert.equal(m.short_name, 'Rocky');
  assert.equal(m.start_url, '/');
  assert.equal(m.scope, '/');
  assert.equal(m.display, 'standalone');
  assert.equal(m.theme_color, '#F6F6F4');
  assert.equal(m.background_color, '#F6F6F4');
  assert.ok(m.icons.some((i) => i.sizes === '192x192' && i.src === '/img/icone-192.png'));
  assert.ok(m.icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable'));
  assert.ok(m.icons.some((i) => i.sizes === '512x512' && (i.purpose ?? 'any') === 'any'));
});

test('sw.js: sintaxe e comportamento essencial', () => {
  const fonte = readFileSync(new URL('../web/sw.js', import.meta.url), 'utf8');
  assert.doesNotThrow(() => new Function('self', 'caches', fonte));
  assert.match(fonte, /addEventListener\('push'/);
  assert.match(fonte, /notificationclick/);
  assert.match(fonte, /openWindow/);
  assert.match(fonte, /skipWaiting/);
  assert.match(fonte, /clients\.claim/);
  assert.doesNotMatch(fonte, /addEventListener\('fetch'/);
});

test('sw.js: push mostra notificação, mesmo com payload inválido', async () => {
  const fonte = readFileSync(new URL('../web/sw.js', import.meta.url), 'utf8');
  const ouvintes = {};
  const mostradas = [];
  const self = {
    addEventListener: (n, f) => { ouvintes[n] = f; },
    registration: { showNotification: (t, o) => { mostradas.push([t, o]); return Promise.resolve(); } },
    skipWaiting: () => {},
    clients: { claim: () => Promise.resolve() },
  };
  new Function('self', 'caches', fonte)(self, {});
  const rodar = async (data) => {
    let p;
    ouvintes.push({ data, waitUntil: (x) => { p = x; } });
    await p;
  };
  await rodar({ json: () => ({ titulo: 'Rocky', corpo: 'Barulho', url: '/x', tag: 't' }) });
  assert.equal(mostradas[0][0], 'Rocky');
  assert.equal(mostradas[0][1].body, 'Barulho');
  assert.equal(mostradas[0][1].data.url, '/x');
  await rodar({ json: () => { throw new Error('ruim'); } });
  assert.equal(mostradas[1][0], 'Rocky');
  assert.equal(mostradas[1][1].body, 'Novo aviso do monitor.');
  await rodar(null);
  assert.equal(mostradas.length, 3);
});

test('sw.js: clique só abre url relativa', async () => {
  const fonte = readFileSync(new URL('../web/sw.js', import.meta.url), 'utf8');
  const ouvintes = {};
  const abertas = [];
  const self = {
    addEventListener: (n, f) => { ouvintes[n] = f; },
    registration: {},
    skipWaiting: () => {},
    location: { origin: 'https://x.ts.net' },
    clients: { claim: () => Promise.resolve(), matchAll: () => Promise.resolve([]), openWindow: (u) => { abertas.push(u); return Promise.resolve(); } },
  };
  new Function('self', 'caches', fonte)(self, {});
  for (const url of ['/ver', 'https://mau.com/', '//mau.com']) {
    let p;
    ouvintes.notificationclick({ notification: { close() {}, data: { url } }, waitUntil: (x) => { p = x; } });
    await p;
  }
  assert.deepEqual(abertas, ['/ver', '/', '/']);
});
