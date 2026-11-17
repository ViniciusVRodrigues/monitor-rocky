import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cenario, procFalso, esperar } from './servidor-util.js';
import { criarNivel } from '../src/servidor/nivel.js';

function pcm(valor, amostras) {
  const b = Buffer.alloc(amostras * 2);
  for (let i = 0; i < amostras; i++) b.writeInt16LE(valor, i * 2);
  return b;
}

test('SSE: estado inicial, troca de estado, evento novo e batida', async () => {
  let ouvinteEvento;
  const c = await cenario({ cfg: { sseBatidaSegundos: 0.05 }, aoEvento: (fn) => { ouvinteEvento = fn; } });
  try {
    const s = await c.fluxo('/api/ao-vivo');
    assert.equal(s.status, 200);
    assert.match(s.res.headers['content-type'], /text\/event-stream/);
    await esperar(() => s.texto().includes('event: estado'));
    assert.match(s.texto(), /event: estado\ndata: \{"estado":"gravando","ouvindoPC":false\}/);
    await c.postar('camera-desligar');
    await esperar(() => s.texto().includes('"estado":"so-som"'));
    ouvinteEvento({ id: 'e1', inicio: '2026-11-17T14:00:00-03:00', tipo: 'som', intensidade: 0.5 });
    await esperar(() => s.texto().includes('event: evento'));
    assert.match(s.texto(), /"id":"e1"/);
    await esperar(() => s.texto().includes(': batida'));
    s.fechar();
  } finally { await c.fim(); }
});

test('SSE: nível vai como evento e só inscreve no distribuidor com cliente', async () => {
  const c = await cenario({ cfg: { ouvirHz: 1000, nivelHz: 10 } });
  try {
    const d = c.monitor.distribuidor;
    assert.equal(d.ouvintes(), 0);
    const s = await c.fluxo('/api/ao-vivo');
    await esperar(() => d.ouvintes() === 1);
    const s2 = await c.fluxo('/api/ao-vivo');
    await esperar(() => s2.texto().includes('event: estado'));
    assert.equal(d.ouvintes(), 1, 'uma inscrição para todos os clientes');
    d.publicar(pcm(32767, 100));
    await esperar(() => s.texto().includes('event: nivel'));
    assert.match(s.texto(), /event: nivel\ndata: \{"nivel":0\.99\d?\d?\}|event: nivel\ndata: \{"nivel":1\}/);
    s.fechar();
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(d.ouvintes(), 1, 'ainda há um cliente');
    s2.fechar();
    await esperar(() => d.ouvintes() === 0);
  } finally { await c.fim(); }
});

test('nivel: silêncio dá 0; onda cheia perto de 1; descida suavizada', () => {
  const v = [];
  const n = criarNivel({ ouvirHz: 1000, nivelHz: 10, suavizacao: 0.6, pisoDb: -60, aoNivel: (x) => v.push(x) });
  n.alimentar(pcm(0, 100));
  assert.deepEqual(v, [0]);
  n.alimentar(pcm(32767, 100));
  assert.ok(v[1] > 0.99 && v[1] <= 1, `cheia ${v[1]}`);
  n.alimentar(pcm(0, 100));
  assert.equal(v[2], Math.round(v[1] * 0.6 * 1000) / 1000);
  n.alimentar(pcm(0, 100));
  assert.ok(v[3] < v[2] && v[3] > 0);
  // metade da amplitude = -6 dBFS => 0,9
  n.alimentar(pcm(0, 1000));
  n.alimentar(pcm(16384, 100));
  assert.ok(Math.abs(v.at(-1) - 0.9) < 0.01, `meia ${v.at(-1)}`);
});

test('nivel: byte ímpar entre blocos e blocos pequenos não perdem amostras', () => {
  const v = [];
  const n = criarNivel({ ouvirHz: 1000, nivelHz: 10, suavizacao: 0, pisoDb: -60, aoNivel: (x) => v.push(x) });
  const tudo = pcm(20000, 100);
  n.alimentar(tudo.subarray(0, 51));
  n.alimentar(tudo.subarray(51, 52));
  n.alimentar(tudo.subarray(52, 199));
  assert.equal(v.length, 0);
  n.alimentar(tudo.subarray(199));
  assert.equal(v.length, 1);
  const ref = [];
  criarNivel({ ouvirHz: 1000, nivelHz: 10, suavizacao: 0, pisoDb: -60, aoNivel: (x) => ref.push(x) }).alimentar(tudo);
  assert.deepEqual(v, ref);
});

test('ouvir PCM recebe os bytes publicados, com X-Taxa', async () => {
  const c = await cenario();
  try {
    const s = await c.fluxo('/api/ouvir/pcm');
    assert.equal(s.status, 200);
    assert.equal(s.res.headers['x-taxa'], '16000');
    assert.equal(s.res.headers['content-type'], 'application/octet-stream');
    await esperar(() => c.monitor.distribuidor.ouvintes() === 1);
    c.monitor.distribuidor.publicar(Buffer.from([1, 2, 3, 4]));
    await esperar(() => s.buf().length === 4);
    assert.deepEqual([...s.buf()], [1, 2, 3, 4]);
    s.fechar();
    await esperar(() => c.monitor.distribuidor.ouvintes() === 0);
  } finally { await c.fim(); }
});

test('ouvir PCM: acima de ouvirSiteMax dá 503', async () => {
  const c = await cenario({ cfg: { ouvirSiteMax: 1 } });
  try {
    const a = await c.fluxo('/api/ouvir/pcm');
    await esperar(() => c.monitor.distribuidor.ouvintes() === 1);
    assert.equal((await c.req('/api/ouvir/pcm')).status, 503);
    a.fechar();
    await esperar(() => c.monitor.distribuidor.ouvintes() === 0);
    const b = await c.fluxo('/api/ouvir/pcm');
    assert.equal(b.status, 200);
    b.fechar();
  } finally { await c.fim(); }
});

test('ouvir MP3: um spawn compartilhado, liga no primeiro e desliga no último; 503 no limite', async () => {
  const procs = []; const chamadas = [];
  const spawn = (cmd, args) => { chamadas.push([cmd, args]); const p = procFalso(); procs.push(p); return p; };
  const c = await cenario({ spawn, cfg: { ouvirSiteMax: 2, ouvirMp3Bitrate: '24k' } });
  try {
    assert.equal(procs.length, 0);
    const a = await c.fluxo('/api/ouvir/mp3');
    assert.equal(a.status, 200);
    assert.equal(a.res.headers['content-type'], 'audio/mpeg');
    assert.equal(procs.length, 1);
    const linha = chamadas[0][1].join(' ');
    assert.match(linha, /-f s16le -ar 16000 -ac 1 -i pipe:0 -c:a libmp3lame -b:a 24k -f mp3 -flush_packets 1 pipe:1$/);
    const b = await c.fluxo('/api/ouvir/mp3');
    assert.equal(procs.length, 1, 'codificador compartilhado');
    assert.equal((await c.req('/api/ouvir/mp3')).status, 503);
    // PCM do distribuidor chega ao stdin do codificador; o MP3 dele vai aos dois clientes
    c.monitor.distribuidor.publicar(Buffer.from('pcm'));
    assert.equal(procs[0].recebidos.length, 1);
    procs[0].stdout.emit('data', Buffer.from('mp3!'));
    await esperar(() => a.buf().length === 4 && b.buf().length === 4);
    a.fechar();
    await esperar(() => c.servidor.ouvirSite.ouvintes().mp3 === 1);
    assert.equal(procs[0].matou, false, 'ainda há um ouvinte');
    b.fechar();
    await esperar(() => procs[0].matou);
    assert.equal(c.monitor.distribuidor.ouvintes(), 0);
    assert.equal(c.servidor.ouvirSite.codificadorAtivo(), false);
    // novo ouvinte liga outro codificador
    const d = await c.fluxo('/api/ouvir/mp3');
    assert.equal(procs.length, 2);
    d.fechar();
  } finally { await c.fim(); }
});

test('ouvir MP3: spawn que falha dá 503; fechar() encerra o codificador', async () => {
  const c = await cenario({ spawn: () => { throw new Error('sem ffmpeg'); } });
  try { assert.equal((await c.req('/api/ouvir/mp3')).status, 503); } finally { await c.fim(); }
  const procs = [];
  const c2 = await cenario({ spawn: () => { const p = procFalso(); procs.push(p); return p; } });
  try {
    await c2.fluxo('/api/ouvir/mp3');
    await esperar(() => procs.length === 1);
  } finally { await c2.fim(); }
  assert.equal(procs[0].matou, true);
});
