import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cenario, monitorFalso } from './servidor-util.js';

test('Host desconhecido dá 421; os permitidos passam', async () => {
  const c = await cenario();
  try {
    assert.equal((await c.req('/api/estado', { headers: { Host: 'evil.example' } })).status, 421);
    assert.equal((await c.req('/api/estado', { headers: { Host: `127.0.0.1:${c.porta + 1}` } })).status, 421);
    assert.equal((await c.req('/api/estado', { headers: { Host: `localhost:${c.porta}` } })).status, 200);
    assert.equal((await c.req('/api/estado', { headers: { Host: 'ROCKY.exemplo.test' } })).status, 200);
  } finally { await c.fim(); }
});

test('middleware antes roda depois do host e antes das rotas; false encerra', async () => {
  const chamadas = [];
  const antes = [
    async (req) => { chamadas.push(req.url); return true; },
    async (req, res) => {
      if (req.url === '/api/estado') { res.writeHead(403); res.end('nao'); return false; }
      return true;
    },
  ];
  const c = await cenario({ antes });
  try {
    const r = await c.req('/api/estado');
    assert.equal(r.status, 403);
    assert.equal(r.texto, 'nao');
    assert.equal((await c.req('/api/config')).status, 200);
    await c.req('/api/estado', { headers: { Host: 'evil.example' } });
    assert.deepEqual(chamadas, ['/api/estado', '/api/config'], 'host recusado não chega ao middleware');
  } finally { await c.fim(); }
});

test('cabeçalhos de segurança em toda resposta e no-store na API', async () => {
  const c = await cenario();
  try {
    for (const caminho of ['/api/estado', '/', '/nao-existe']) {
      const r = await c.req(caminho);
      assert.match(r.headers['content-security-policy'], /default-src 'self'/);
      assert.match(r.headers['content-security-policy'], /frame-ancestors 'none'/);
      assert.equal(r.headers['x-content-type-options'], 'nosniff');
      assert.equal(r.headers['referrer-policy'], 'no-referrer');
    }
    assert.equal((await c.req('/api/estado')).headers['cache-control'], 'no-store');
    assert.equal((await c.req('/', { headers: { Host: 'evil.example' } })).headers['x-content-type-options'], 'nosniff');
  } finally { await c.fim(); }
});

test('/api/config, /api/estado e estáticos', async () => {
  const c = await cenario({ cfg: { somAoAbrir: false } });
  try {
    const cfg = (await c.req('/api/config')).json;
    assert.equal(cfg.somAoAbrir, false);
    assert.equal(cfg.nivelHz, 10);
    assert.equal(cfg.ouvirHz, 16000);
    assert.equal(cfg.ouvirModo, 'auto');
    const est = (await c.req('/api/estado')).json;
    assert.equal(est.estado, 'gravando');
    assert.equal(est.ouvindoPC, false);
    assert.match(est.agora, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
    assert.equal((await c.req('/')).texto, '<h1>oi</h1>');
    assert.equal((await c.req('/js/app.js')).status, 200);
    assert.equal((await c.req('/segredo.txt')).status, 404);
    assert.equal((await c.req('/js/../segredo.txt')).status, 404);
    assert.equal((await c.req('/vendor/outro.js')).status, 404);
  } finally { await c.fim(); }
});

test('controle: GET dá 405, escrita sem cabeçalhos dá 403 e o estado não muda', async () => {
  const c = await cenario();
  try {
    assert.equal((await c.req('/api/controle')).status, 405);
    assert.equal((await c.req('/api/controle', { metodo: 'PUT' })).status, 405);
    const corpo = JSON.stringify({ acao: 'parar' });
    const cab = { 'Content-Type': 'application/json', 'X-Rocky': '1' };
    const semRocky = await c.req('/api/controle', { metodo: 'POST', headers: { 'Content-Type': 'application/json' }, corpo });
    assert.equal(semRocky.status, 403);
    assert.equal((await c.req('/api/controle', { metodo: 'POST', headers: { ...cab, Origin: 'https://evil.example' }, corpo })).status, 403);
    assert.equal((await c.req('/api/controle', { metodo: 'POST', headers: { ...cab, 'Content-Type': 'application/x-www-form-urlencoded' }, corpo })).status, 403);
    assert.equal((await c.req('/api/controle', { metodo: 'POST', headers: { ...cab, 'Content-Type': 'text/plain' }, corpo })).status, 403);
    assert.equal((await c.req('/api/controle', { metodo: 'POST', headers: { ...cab, 'Sec-Fetch-Site': 'cross-site' }, corpo })).status, 403);
    assert.equal((await c.req('/api/controle', { metodo: 'POST', headers: { ...cab, 'Sec-Fetch-Site': 'same-site' }, corpo })).status, 403);
    assert.equal(semRocky.json.erro, 'Pedido recusado.');
    assert.equal(c.monitor.gravador.estado(), 'gravando');
    const ok = await c.req('/api/controle', { metodo: 'POST', headers: { ...cab, 'Sec-Fetch-Site': 'same-origin', Origin: `http://127.0.0.1:${c.porta}` }, corpo });
    assert.equal(ok.status, 200);
    assert.equal(c.monitor.gravador.estado(), 'parado');
  } finally { await c.fim(); }
});

test('controle: 200 muda estado, 400, 409 em parado, ouvir PC', async () => {
  const c = await cenario();
  try {
    let r = await c.postar('camera-desligar');
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { ok: true, estado: 'so-som', ouvindoPC: false });
    r = await c.postar('ouvir-pc-ligar');
    assert.deepEqual(r.json, { ok: true, estado: 'so-som', ouvindoPC: true });
    r = await c.postar('ouvir-pc-desligar');
    assert.equal(r.json.ouvindoPC, false);
    r = await c.postar('camera-ligar');
    assert.equal(r.json.estado, 'gravando');
    assert.equal((await c.postar('nada')).status, 400);
    assert.equal((await c.postar({ x: 1 })).status, 400);
    const quebrado = await c.req('/api/controle', { metodo: 'POST', headers: { 'Content-Type': 'application/json', 'X-Rocky': '1' }, corpo: '{nao json' });
    assert.equal(quebrado.status, 400);
    assert.equal(quebrado.json.erro, 'Ação desconhecida.');
    assert.equal((await c.postar('parar')).json.estado, 'parado');
    for (const a of ['camera-desligar', 'camera-ligar']) {
      r = await c.postar(a);
      assert.equal(r.status, 409);
      assert.equal(r.json.erro, 'A captura está parada; use Voltar a gravar primeiro.');
    }
    assert.equal((await c.postar('gravar')).json.estado, 'gravando');
  } finally { await c.fim(); }
});

test('controle: corpo acima de 1 KB é recusado', async () => {
  const c = await cenario();
  try {
    const r = await c.req('/api/controle', { metodo: 'POST', headers: { 'Content-Type': 'application/json', 'X-Rocky': '1' }, corpo: JSON.stringify({ acao: 'x'.repeat(3000) }) }).catch((e) => ({ status: e.code }));
    assert.ok(r.status === 413 || r.status === 'ECONNRESET', `status ${r.status}`);
  } finally { await c.fim(); }
});

test('controle: passou do tempo limite dá 504; erro do monitor dá 500 em pt-BR', async () => {
  const lento = monitorFalso({ demoraMs: 300 });
  const c = await cenario({ monitor: lento, cfg: { controleTempoLimiteSegundos: 0.05 } });
  try {
    const r = await c.postar('parar');
    assert.equal(r.status, 504);
    assert.equal(r.json.erro, 'O monitor não respondeu a tempo.');
  } finally { await c.fim(); }
  const m = monitorFalso();
  m.gravador.iniciar = async () => { throw new Error('Deu ruim.'); };
  const c2 = await cenario({ monitor: m });
  try {
    const r = await c2.postar('gravar');
    assert.equal(r.status, 500);
    assert.equal(r.json.erro, 'Deu ruim.');
    assert.ok(!r.texto.includes('at '), 'sem pilha');
  } finally { await c2.fim(); }
});

test('leituras da API recusam Sec-Fetch-Site cross-site', async () => {
  const c = await cenario();
  try {
    assert.equal((await c.req('/api/estado', { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
    assert.equal((await c.req('/api/estado', { headers: { 'Sec-Fetch-Site': 'same-origin' } })).status, 200);
    assert.equal((await c.req('/', { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 200);
  } finally { await c.fim(); }
});
