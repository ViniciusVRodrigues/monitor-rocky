import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { criarAvisos } from '../src/avisos/index.js';

const HOSTS = ['fcm.googleapis.com', 'web.push.apple.com', 'push.services.mozilla.com', 'notify.windows.com'];
const corpoSub = (n, host = 'fcm.googleapis.com') => ({
  endpoint: `https://${host}/fcm/send/${n}`,
  keys: { p256dh: Buffer.concat([Buffer.from([4]), randomBytes(64)]).toString('base64url'), auth: randomBytes(16).toString('base64url') },
});
const PAYLOAD = { titulo: 't', corpo: 'c', url: '/', tag: 'x' };
function montar(extra = {}, deps = {}) {
  const base = mkdtempSync(join(tmpdir(), 'rocky-avs-'));
  const cfg = {
    pasta: base, avisos: true, avisosPasta: 'avisos', avisoValidadeSegundos: 600, avisoEnvioTimeoutSegundos: 15,
    avisosMaxInscricoes: 10, avisosContato: 'https://exemplo.test/r', avisosHostsPush: HOSTS, ...extra,
  };
  const chamadas = []; const logs = [];
  const enviar = deps.enviar ?? (async (sub, payload, opcoes) => { chamadas.push({ sub, payload, opcoes }); });
  const a = criarAvisos({ cfg, log: (m) => logs.push(m), enviar, gerarChaves: () => ({ publicKey: 'PUB', privateKey: 'PRIV' }), ...deps.resto });
  return { base, cfg, a, chamadas, logs, fim: () => rmSync(base, { recursive: true, force: true }) };
}
const erroHttp = (statusCode) => Object.assign(new Error('http ' + statusCode), { statusCode });

test('envia a cada inscrição com as opções certas', async () => {
  const m = montar();
  try {
    const s1 = corpoSub(1); m.a.inscrever(s1); m.a.inscrever(corpoSub(2));
    const r = await m.a.enviarTodos({ titulo: 'Rocky', corpo: 'x', url: '/', tag: 'rocky-som' });
    assert.deepEqual(r, { enviados: 2, apagados: 0, falhas: 0 });
    const c = m.chamadas.find((x) => x.sub.endpoint === s1.endpoint);
    assert.deepEqual(c.sub, s1);
    assert.deepEqual(JSON.parse(c.payload), { titulo: 'Rocky', corpo: 'x', url: '/', tag: 'rocky-som' });
    assert.equal(c.opcoes.urgency, 'high');
    assert.equal(c.opcoes.TTL, 600);
    assert.equal(c.opcoes.topic, 'rocky-som');
    assert.equal(c.opcoes.timeout, 15000);
    assert.deepEqual(c.opcoes.vapidDetails, { subject: 'https://exemplo.test/r', publicKey: 'PUB', privateKey: 'PRIV' });
    assert.equal(m.a.chavePublica(), 'PUB');
  } finally { m.fim(); }
});

test('topic só entra se a tag couber (até 32, base64url)', async () => {
  const m = montar();
  try {
    m.a.inscrever(corpoSub(1));
    await m.a.enviarTodos({ ...PAYLOAD, tag: 'tem espaço' });
    await m.a.enviarTodos({ ...PAYLOAD, tag: 'a'.repeat(33) });
    await m.a.enviarTodos({ titulo: 't', corpo: 'c', url: '/' });
    assert.equal(m.chamadas.length, 3);
    for (const c of m.chamadas) assert.equal('topic' in c.opcoes, false);
  } finally { m.fim(); }
});

test('404 e 410 apagam a inscrição e os outros seguem; 500 não apaga', async () => {
  const subs = [corpoSub('ok'), corpoSub('gone'), corpoSub('nf'), corpoSub('err')];
  const m = montar({}, { enviar: async (sub) => {
    if (sub.endpoint.endsWith('gone')) throw erroHttp(410);
    if (sub.endpoint.endsWith('nf')) throw erroHttp(404);
    if (sub.endpoint.endsWith('err')) throw erroHttp(500);
  } });
  try {
    for (const s of subs) m.a.inscrever(s);
    const r = await m.a.enviarTodos(PAYLOAD);
    assert.deepEqual(r, { enviados: 1, apagados: 2, falhas: 1 });
    assert.equal(m.a.tem(subs[0].endpoint), true);
    assert.equal(m.a.tem(subs[1].endpoint), false);
    assert.equal(m.a.tem(subs[2].endpoint), false);
    assert.equal(m.a.tem(subs[3].endpoint), true);
    assert.equal(m.a.quantas(), 2);
    assert.ok(m.logs.some((l) => l.includes('fcm.googleapis.com')));
    assert.ok(m.logs.every((l) => !l.includes('/fcm/send/')), 'log sem o endpoint inteiro');
  } finally { m.fim(); }
});

test('endpoint fora da lista no arquivo é pulado e apagado, sem envio', async () => {
  const m = montar();
  try {
    m.a.inscrever(corpoSub(1));
    const arq = join(m.base, 'avisos', 'inscricoes.json');
    const lista = JSON.parse(readFileSync(arq, 'utf8'));
    lista.push({ endpoint: 'https://interno.local/x', keys: lista[0].keys, criada: lista[0].criada });
    writeFileSync(arq, JSON.stringify(lista));
    const a2 = criarAvisos({ cfg: m.cfg, log: () => {}, enviar: async (s) => { m.chamadas.push({ sub: s }); }, gerarChaves: () => ({ publicKey: 'P', privateKey: 'K' }) });
    const r = await a2.enviarTodos(PAYLOAD);
    assert.equal(r.apagados, 1); assert.equal(r.enviados, 1);
    assert.deepEqual(m.chamadas.map((c) => c.sub.endpoint), [lista[0].endpoint]);
    assert.equal(a2.quantas(), 1);
  } finally { m.fim(); }
});

test('inscrever recusa endpoint fora da lista com 400', () => {
  const m = montar();
  try {
    assert.throws(() => m.a.inscrever(corpoSub(1, 'evil.example')), (e) => e.status === 400);
    assert.equal(m.a.quantas(), 0);
  } finally { m.fim(); }
});

test('enviarPara: 404 se não inscrito, 502 se o serviço recusa, ok se envia', async () => {
  let falhar = false;
  const m = montar({}, { enviar: async () => { if (falhar) throw erroHttp(500); } });
  try {
    const s = corpoSub(1);
    await assert.rejects(m.a.enviarPara(s.endpoint, PAYLOAD), (e) => e.status === 404);
    m.a.inscrever(s);
    await m.a.enviarPara(s.endpoint, PAYLOAD);
    falhar = true;
    await assert.rejects(m.a.enviarPara(s.endpoint, PAYLOAD), (e) => e.status === 502);
    assert.equal(m.a.tem(s.endpoint), true);
  } finally { m.fim(); }
});

test('enviarPara apaga a inscrição quando o serviço responde 410', async () => {
  const m = montar({}, { enviar: async () => { throw erroHttp(410); } });
  try {
    const s = corpoSub(1); m.a.inscrever(s);
    await assert.rejects(m.a.enviarPara(s.endpoint, PAYLOAD), (e) => e.status === 404);
    assert.equal(m.a.tem(s.endpoint), false);
  } finally { m.fim(); }
});

test('avisos desligados: não gera chaves, não cria pasta, não envia', async () => {
  let gerou = 0;
  const m = montar({ avisos: false }, { resto: { gerarChaves: () => { gerou++; return { publicKey: 'a', privateKey: 'b' }; } } });
  try {
    assert.equal(m.a.ligado, false);
    assert.equal(gerou, 0);
    assert.equal(existsSync(join(m.base, 'avisos')), false);
    assert.deepEqual(await m.a.enviarTodos(PAYLOAD), { enviados: 0, apagados: 0, falhas: 0 });
    assert.equal(m.a.quantas(), 0);
  } finally { m.fim(); }
});

test('cancelar e tem passam pelo armazém', () => {
  const m = montar();
  try {
    const s = corpoSub(1); m.a.inscrever(s);
    assert.equal(m.a.tem(s.endpoint), true);
    m.a.cancelar(s.endpoint); m.a.cancelar(s.endpoint);
    assert.equal(m.a.tem(s.endpoint), false);
  } finally { m.fim(); }
});
