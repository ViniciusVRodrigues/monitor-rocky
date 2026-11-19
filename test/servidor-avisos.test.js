import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { criarAvisos } from '../src/avisos/index.js';
import { cenario } from './servidor-util.js';

const HOSTS = ['fcm.googleapis.com', 'web.push.apple.com', 'push.services.mozilla.com', 'notify.windows.com'];
const sub = (n, host = 'fcm.googleapis.com') => ({
  endpoint: `https://${host}/fcm/send/${n}`,
  keys: { p256dh: Buffer.concat([Buffer.from([4]), randomBytes(64)]).toString('base64url'), auth: randomBytes(16).toString('base64url') },
});
const POST = { 'Content-Type': 'application/json', 'X-Rocky': '1' };

/** Sobe um cenário com avisos reais (cliente de envio falso). */
async function cenarioAvisos({ cfg = {}, enviar, desligado = false } = {}) {
  const enviados = [];
  const cfgBase = {
    avisos: !desligado, avisosPasta: 'avisos', avisoValidadeSegundos: 600, avisoEnvioTimeoutSegundos: 15, avisosMaxInscricoes: 10,
    avisosContato: 'https://exemplo.test/r', avisosHostsPush: HOSTS, avisoSomSegundos: 20, avisoIntervaloMinutos: 10,
    avisoSilencioInicio: '22:00', avisoSilencioFim: '07:00', ...cfg,
  };
  const c = await cenario({
    cfg: cfgBase,
    avisos: (cfgFinal) => criarAvisos({
      cfg: cfgFinal, log: () => {},
      enviar: enviar ?? (async (s, p, o) => { enviados.push({ s, p: JSON.parse(p), o }); }),
      gerarChaves: () => ({ publicKey: 'CHAVE-PUB', privateKey: 'CHAVE-PRIV' }),
    }),
  });
  return { c, enviados };
}

const postar = (c, caminho, corpo, extra = {}) => c.req(caminho, {
  metodo: 'POST', headers: { ...POST, ...extra }, corpo: typeof corpo === 'string' ? corpo : JSON.stringify(corpo),
});

test('GET /api/avisos/chave devolve a chave pública', async () => {
  const { c } = await cenarioAvisos();
  try {
    const r = await c.req('/api/avisos/chave');
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { chave: 'CHAVE-PUB' });
    assert.equal((await c.req('/api/avisos/chave', { metodo: 'POST', headers: POST, corpo: '{}' })).status, 405);
  } finally { await c.fim(); }
});

test('inscrever persiste, cancelar apaga (idempotente)', async () => {
  const { c } = await cenarioAvisos();
  try {
    const s = sub(1);
    const r = await postar(c, '/api/avisos/inscrever', { ...s, expirationTime: null, extra: 'x' });
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { ok: true });
    const arq = join(c.pasta, 'avisos', 'inscricoes.json');
    const guardado = JSON.parse(readFileSync(arq, 'utf8'));
    assert.equal(guardado.length, 1);
    assert.deepEqual(Object.keys(guardado[0]).sort(), ['criada', 'endpoint', 'keys']);
    assert.equal((await postar(c, '/api/avisos/inscrever', s)).status, 200);
    assert.equal(JSON.parse(readFileSync(arq, 'utf8')).length, 1, 'upsert');
    assert.equal((await postar(c, '/api/avisos/cancelar', { endpoint: s.endpoint })).status, 200);
    assert.equal((await postar(c, '/api/avisos/cancelar', { endpoint: s.endpoint })).status, 200);
    assert.deepEqual(JSON.parse(readFileSync(arq, 'utf8')), []);
  } finally { await c.fim(); }
});

test('inscrever e cancelar: 400 para corpo ruim, 403 sem controle, 405 em GET, 413 grande', async () => {
  const { c } = await cenarioAvisos();
  try {
    for (const rota of ['inscrever', 'cancelar', 'teste']) {
      const p = `/api/avisos/${rota}`;
      assert.equal((await postar(c, p, '{lixo')).status, 400, `${rota} json inválido`);
      assert.equal((await postar(c, p, '[]')).status, 400, `${rota} array`);
      assert.equal((await postar(c, p, '5')).status, 400, `${rota} número`);
      const g = await postar(c, p, { endpoint: 'x'.repeat(5000) }).catch((e) => ({ status: e.code })); // o servidor corta a conexão ao passar do limite
      assert.ok(g.status === 413 || g.status === 'ECONNRESET', `${rota} grande: ${g.status}`);
      assert.equal((await c.req(p, { metodo: 'POST', headers: { 'X-Rocky': '1' }, corpo: '{}' })).status, 403, `${rota} sem json`);
      assert.equal((await c.req(p, { metodo: 'POST', headers: { 'Content-Type': 'application/json' }, corpo: '{}' })).status, 403, `${rota} sem X-Rocky`);
      assert.equal((await c.req(p, { metodo: 'POST', headers: { ...POST, 'Sec-Fetch-Site': 'cross-site' }, corpo: '{}' })).status, 403, `${rota} cross-site`);
      assert.equal((await c.req(p)).status, 405, `${rota} GET`);
    }
    assert.equal((await postar(c, '/api/avisos/inscrever', { endpoint: 'https://evil.example/x', keys: sub(1).keys })).status, 400);
    assert.equal((await postar(c, '/api/avisos/inscrever', { endpoint: 'http://fcm.googleapis.com/x', keys: sub(1).keys })).status, 400);
    assert.equal((await postar(c, '/api/avisos/inscrever', { endpoint: sub(1).endpoint })).status, 400);
    assert.equal((await postar(c, '/api/avisos/cancelar', {})).status, 400);
    assert.equal((await postar(c, '/api/avisos/cancelar', { endpoint: 5 })).status, 400);
    assert.equal(existsSync(join(c.pasta, 'avisos', 'inscricoes.json')), false, 'nada gravado');
  } finally { await c.fim(); }
});

test('teste: envia só à inscrição pedida; 404 se não inscrito; 502 se o serviço recusa', async () => {
  let falhar = false;
  const { c, enviados } = await cenarioAvisos({ enviar: async (s, p, o) => { if (falhar) throw Object.assign(new Error('x'), { statusCode: 500 }); enviados.push({ s, p: JSON.parse(p), o }); } });
  try {
    const a = sub('a'); const b = sub('b');
    await postar(c, '/api/avisos/inscrever', a);
    await postar(c, '/api/avisos/inscrever', b);
    assert.equal((await postar(c, '/api/avisos/teste', { endpoint: sub('zzz').endpoint })).status, 404);
    const r = await postar(c, '/api/avisos/teste', { endpoint: a.endpoint });
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { ok: true });
    assert.equal(enviados.length, 1);
    assert.equal(enviados[0].s.endpoint, a.endpoint);
    assert.deepEqual(enviados[0].p, { titulo: 'Rocky', corpo: 'Aviso de teste. Se você está vendo isto, os avisos funcionam.', url: '/', tag: 'rocky-teste' });
    falhar = true;
    assert.equal((await postar(c, '/api/avisos/teste', { endpoint: a.endpoint })).status, 502);
  } finally { await c.fim(); }
});

test('avisos desligados ou ausentes: rotas dão 404; /api/config diz avisos false', async () => {
  const { c } = await cenarioAvisos({ desligado: true });
  const sem = await cenario();
  try {
    for (const alvo of [c, sem]) {
      assert.equal((await alvo.req('/api/avisos/chave')).status, 404);
      for (const rota of ['inscrever', 'cancelar', 'teste']) {
        assert.equal((await postar(alvo, `/api/avisos/${rota}`, sub(1))).status, 404, rota);
      }
      assert.equal((await alvo.req('/api/config')).json.avisos, false);
    }
    assert.equal(existsSync(join(c.pasta, 'avisos')), false);
  } finally { await c.fim(); await sem.fim(); }
});

test('/api/config traz os campos de avisos e o endereço da tailnet', async () => {
  const { c } = await cenarioAvisos();
  try {
    const j = (await c.req('/api/config')).json;
    assert.equal(j.avisos, true);
    assert.equal(j.avisoSomSegundos, 20);
    assert.equal(j.avisoIntervaloMinutos, 10);
    assert.equal(j.avisoSilencioInicio, '22:00');
    assert.equal(j.avisoSilencioFim, '07:00');
    assert.equal(j.enderecoTailnet, 'rocky.exemplo.test');
  } finally { await c.fim(); }
  const v = await cenario({ cfg: { hostsPermitidos: [] } });
  try { assert.equal((await v.req('/api/config')).json.enderecoTailnet, ''); } finally { await v.fim(); }
});

test('Host da tailnet sem login: 403 em /api/avisos/*, /sw.js e /manifest.webmanifest; com login passa', async () => {
  const { c } = await cenarioAvisos();
  try {
    mkdirSync(join(c.raiz, 'web', 'img'), { recursive: true });
    writeFileSync(join(c.raiz, 'web', 'sw.js'), '// sw');
    writeFileSync(join(c.raiz, 'web', 'manifest.webmanifest'), '{}');
    writeFileSync(join(c.raiz, 'web', 'img', 'icone-192.png'), 'png');
    const host = { Host: 'rocky.exemplo.test' };
    const login = { ...host, 'Tailscale-User-Login': 'eu@exemplo.test' };
    for (const caminho of ['/api/avisos/chave', '/sw.js', '/manifest.webmanifest', '/img/icone-192.png']) {
      assert.equal((await c.req(caminho, { headers: host })).status, 403, caminho);
      assert.equal((await c.req(caminho, { headers: login })).status, 200, caminho);
    }
    for (const rota of ['inscrever', 'cancelar', 'teste']) {
      const p = `/api/avisos/${rota}`;
      assert.equal((await c.req(p, { metodo: 'POST', headers: { ...host, ...POST }, corpo: '{}' })).status, 403, p);
      assert.notEqual((await c.req(p, { metodo: 'POST', headers: { ...login, ...POST, Origin: 'https://rocky.exemplo.test' }, corpo: '{}' })).status, 403, p);
    }
  } finally { await c.fim(); }
});

test('estáticos novos são servidos; chaves e inscrições nunca', async () => {
  const { c } = await cenarioAvisos();
  try {
    mkdirSync(join(c.raiz, 'web', 'img'), { recursive: true });
    writeFileSync(join(c.raiz, 'web', 'sw.js'), '// sw');
    writeFileSync(join(c.raiz, 'web', 'manifest.webmanifest'), '{"name":"Rocky"}');
    for (const n of ['icone-192.png', 'icone-512.png', 'badge-96.png']) writeFileSync(join(c.raiz, 'web', 'img', n), 'png');
    const sw = await c.req('/sw.js');
    assert.equal(sw.status, 200);
    assert.match(sw.headers['content-type'], /javascript/);
    assert.equal(sw.headers['cache-control'], 'no-cache');
    const m = await c.req('/manifest.webmanifest');
    assert.equal(m.status, 200);
    assert.match(m.headers['content-type'], /manifest\+json/);
    for (const n of ['icone-192.png', 'icone-512.png', 'badge-96.png']) {
      const r = await c.req(`/img/${n}`);
      assert.equal(r.status, 200, n);
      assert.equal(r.headers['content-type'], 'image/png');
    }
    await postar(c, '/api/avisos/inscrever', sub(1));
    for (const caminho of ['/arquivos/avisos/vapid.json', '/arquivos/avisos/inscricoes.json', '/avisos/vapid.json', '/vapid.json', '/gravacoes/avisos/vapid.json']) {
      assert.equal((await c.req(caminho)).status, 404, caminho);
    }
  } finally { await c.fim(); }
});
