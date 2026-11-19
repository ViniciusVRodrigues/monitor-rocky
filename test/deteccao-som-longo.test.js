import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { iniciarDeteccao } from '../src/deteccao/index.js';

function pcm(ms, amp, hz = 16000) {
  const n = Math.round((hz * ms) / 1000);
  const b = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) b.writeInt16LE(i % 2 ? amp : -amp, i * 2);
  return b;
}

const T0 = new Date(2026, 10, 18, 14, 0, 0).getTime();

async function montar(extra = {}) {
  const pasta = mkdtempSync(join(tmpdir(), 'rocky-som-'));
  let agora = T0;
  let inscrito = null;
  const deps = {
    relogio: () => agora,
    esperar: () => Promise.resolve(),
    abrirPipe: async () => ({ destinoFfmpeg: 'x', fechar: async () => {} }),
    acharTrechos: async () => [],
    recortarClipe: async () => ({ clipe: false, miniatura: false }),
    intervaloVerificarMs: 5,
  };
  const distribuidor = { inscrever: (fn) => { inscrito = fn; return () => { inscrito = null; }; } };
  const cfg = { pasta, ouvirHz: 16000, resolucao: '1280x720', clipesDias: 0, ...extra };
  const d = await iniciarDeteccao(cfg, { log: () => {}, deps });
  d.ligar({ distribuidor });
  return {
    d,
    // define o relógio e toca um trecho de som alto naquele instante
    som: (offsetMs) => { agora = T0 + offsetMs; inscrito(pcm(500, 20000)); },
    ir: (offsetMs) => { agora = T0 + offsetMs; },
    tick: () => new Promise((r) => setTimeout(r, 30)),
    fim: async () => { await d.parar(); rmSync(pasta, { recursive: true, force: true }); },
  };
}

test('dispara uma vez ao chegar em N segundos, com inicio e duracaoMs', async () => {
  const m = await montar({ avisoSomSegundos: 20 });
  try {
    const rec = [];
    m.d.aoSomLongo((e) => rec.push(e));
    m.som(0);
    m.som(8000);
    m.som(16000);
    m.som(19400); // 19,9 s de som: ainda não
    await m.tick();
    assert.equal(rec.length, 0);
    m.som(19500); // exatamente 20 s de som (o detector marca o início 500 ms antes do relógio): dispara (>=)
    await m.tick();
    await m.tick();
    assert.equal(rec.length, 1);
    assert.equal(rec[0].inicio, T0 - 500);
    assert.equal(rec[0].duracaoMs, 20000);
    m.som(26000);
    await m.tick();
    assert.equal(rec.length, 1, 'não repete no mesmo evento');
  } finally { await m.fim(); }
});

test('abaixo de N segundos não dispara', async () => {
  const m = await montar({ avisoSomSegundos: 20 });
  try {
    let n = 0;
    m.d.aoSomLongo(() => n++);
    m.som(0);
    m.som(9000);
    m.som(19000);
    await m.tick();
    assert.equal(n, 0);
  } finally { await m.fim(); }
});

test('evento novo depois de fechar dispara de novo', async () => {
  const m = await montar({ avisoSomSegundos: 10 });
  try {
    const rec = [];
    m.d.aoSomLongo((e) => rec.push(e));
    m.som(0);
    m.som(9000);
    m.som(10000);
    await m.tick();
    assert.equal(rec.length, 1);
    m.ir(60000); // silêncio longo: o evento fecha
    await m.tick();
    m.som(100000);
    m.som(109000);
    m.som(110000);
    await m.tick();
    assert.equal(rec.length, 2);
    assert.ok(rec[1].inicio >= T0 + 99000 && rec[1].inicio <= T0 + 100000, "é o início do segundo evento");
  } finally { await m.fim(); }
});

test('sem avisoSomSegundos (ou 0) não dispara', async () => {
  for (const extra of [{}, { avisoSomSegundos: 0 }]) {
    const m = await montar(extra);
    try {
      let n = 0;
      m.d.aoSomLongo(() => n++);
      m.som(0);
      m.som(9000);
      m.som(18000);
      m.som(30000);
      await m.tick();
      assert.equal(n, 0);
    } finally { await m.fim(); }
  }
});

test('ouvinte que lança não impede o outro nem a detecção', async () => {
  const m = await montar({ avisoSomSegundos: 10 });
  try {
    let n = 0;
    m.d.aoSomLongo(() => { throw new Error('defeito'); });
    m.d.aoSomLongo(() => n++);
    m.som(0);
    m.som(9000);
    m.som(10000);
    await m.tick();
    assert.equal(n, 1);
    m.som(15000); // a detecção segue viva
    await m.tick();
    assert.equal(n, 1);
  } finally { await m.fim(); }
});

test('cancelar o ouvinte funciona', async () => {
  const m = await montar({ avisoSomSegundos: 10 });
  try {
    let n = 0;
    const cancelar = m.d.aoSomLongo(() => n++);
    cancelar();
    m.som(0);
    m.som(9000);
    m.som(10000);
    await m.tick();
    assert.equal(n, 0);
  } finally { await m.fim(); }
});
