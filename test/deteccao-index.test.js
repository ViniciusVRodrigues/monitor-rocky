import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { iniciarDeteccao } from '../src/deteccao/index.js';

// PCM s16le mono: `ms` de tom quadrado com amplitude `amp`.
function pcm(ms, amp, hz = 16000) {
  const n = Math.round((hz * ms) / 1000);
  const b = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) b.writeInt16LE(i % 2 ? amp : -amp, i * 2);
  return b;
}

function montar({ recortar } = {}) {
  const pasta = mkdtempSync(join(tmpdir(), 'rocky-det-'));
  let agora = new Date(2026, 10, 17, 14, 3, 0).getTime();
  let inscrito = null;
  const chamadas = [];
  const deps = {
    relogio: () => agora,
    esperar: () => Promise.resolve(),
    abrirPipe: async () => ({ destinoFfmpeg: '\\\\.\\pipe\\falso', fechar: async () => {} }),
    acharTrechos: async (o) => { chamadas.push(o); return [{ arquivo: 'x.mp4', inicioMs: o.inicioMs, duracaoS: 60, temVideo: false }]; },
    recortarClipe: recortar ?? (async () => ({ clipe: true, miniatura: false, soAudio: true })),
    intervaloVerificarMs: 60 * 60 * 1000,
  };
  const distribuidor = { inscrever: (fn) => { inscrito = fn; return () => { inscrito = null; }; } };
  const cfg = { pasta, ouvirHz: 16000, resolucao: '1280x720', clipesDias: 0 };
  return {
    pasta, deps, distribuidor, cfg, chamadas,
    avancar: (ms) => { agora += ms; },
    tocar: (ms, amp) => { inscrito(pcm(ms, amp)); },
    fim: () => rmSync(pasta, { recursive: true, force: true }),
  };
}

test('som alto vira registro no jsonl e depois aoEvento, com o contrato', async () => {
  const m = montar();
  const logs = [];
  const d = await iniciarDeteccao(m.cfg, { log: (s) => logs.push(s), deps: m.deps });
  try {
    const recebidos = [];
    d.aoEvento((r) => {
      // quando o ouvinte é chamado, a linha já está no arquivo
      const dia = readdirSync(join(m.pasta, 'eventos'))[0];
      const linhas = readFileSync(join(m.pasta, 'eventos', dia), 'utf8').trim().split('\n');
      recebidos.push({ r, linhas: linhas.length });
    });
    d.ligar({ distribuidor: m.distribuidor });
    m.tocar(500, 20000);
    await d.parar();
    assert.equal(recebidos.length, 1);
    const { r } = recebidos[0];
    assert.equal(recebidos[0].linhas, 1);
    assert.deepEqual(Object.keys(r).sort(), ['clipe', 'fim', 'id', 'inicio', 'intensidade', 'miniatura', 'tipo']);
    assert.equal(r.tipo, 'som');
    assert.match(r.inicio, /^2026-11-17T14:0[23]:\d\d[+-]\d\d:\d\d$/);
    assert.match(r.clipe, /^clipes\/2026-11-17\/\d\d-\d\d-\d\d-som\.mp4$/);
    assert.equal(r.miniatura, null);
    assert.ok(r.intensidade > 0 && r.intensidade <= 1);
    // a janela pedida aos trechos cobre pré e pós
    assert.equal(m.chamadas.length, 1);
    assert.ok(m.chamadas[0].fimMs - m.chamadas[0].inicioMs >= 10000);
  } finally { m.fim(); }
});

test('silêncio não gera evento', async () => {
  const m = montar();
  const d = await iniciarDeteccao(m.cfg, { log: () => {}, deps: m.deps });
  try {
    let n = 0;
    d.aoEvento(() => n++);
    d.ligar({ distribuidor: m.distribuidor });
    m.tocar(2000, 30);
    await d.parar();
    assert.equal(n, 0);
    assert.equal(m.chamadas.length, 0);
  } finally { m.fim(); }
});

test('falha no recorte registra o evento com clipe nulo', async () => {
  const m = montar({ recortar: async () => { throw new Error('ffmpeg caiu'); } });
  const logs = [];
  const d = await iniciarDeteccao(m.cfg, { log: (s) => logs.push(s), deps: m.deps });
  try {
    const recebidos = [];
    d.aoEvento((r) => recebidos.push(r));
    d.ligar({ distribuidor: m.distribuidor });
    m.tocar(500, 20000);
    await d.parar();
    assert.equal(recebidos.length, 1);
    assert.equal(recebidos[0].clipe, null);
    assert.equal(recebidos[0].miniatura, null);
    assert.ok(logs.some((l) => /ffmpeg caiu/.test(l)));
  } finally { m.fim(); }
});

test('saidasExtras: quadros cinza só quando há vídeo', async () => {
  const m = montar();
  const d = await iniciarDeteccao(m.cfg, { log: () => {}, deps: m.deps });
  try {
    assert.deepEqual(d.saidasExtras('so-som', { video: null }), []);
    const [extra] = d.saidasExtras('gravando', { video: '0:v' });
    assert.deepEqual(extra.slice(0, 2), ['-map', '0:v']);
    assert.match(extra[3], /^fps=5,scale=160:90,format=gray$/);
    assert.equal(extra.at(-1), '\\\\.\\pipe\\falso');
  } finally { await d.parar(); m.fim(); }
});

test('um ouvinte que lança erro não impede os outros', async () => {
  const m = montar();
  const d = await iniciarDeteccao(m.cfg, { log: () => {}, deps: m.deps });
  try {
    let n = 0;
    d.aoEvento(() => { throw new Error('x'); });
    d.aoEvento(() => n++);
    d.ligar({ distribuidor: m.distribuidor });
    m.tocar(500, 20000);
    await d.parar();
    assert.equal(n, 1);
  } finally { m.fim(); }
});
