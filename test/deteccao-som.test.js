import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarDetectorSom } from '../src/deteccao/som.js';

const HZ = 16000;

// Gera PCM s16le: segmentos de { ms, amp (0..1) } com senoide de 440 Hz.
function pcm(segmentos) {
  const partes = [];
  for (const { ms, amp = 0 } of segmentos) {
    const n = Math.round((HZ * ms) / 1000);
    const b = Buffer.alloc(n * 2);
    for (let i = 0; i < n; i++) {
      b.writeInt16LE(Math.round(amp * 32767 * Math.sin((2 * Math.PI * 440 * i) / HZ)), i * 2);
    }
    partes.push(b);
  }
  return Buffer.concat(partes);
}

function rodar(audio, tamanhos, opcoes = {}) {
  const eventos = [];
  const d = criarDetectorSom({
    hz: HZ, limiarDb: -30, janelaMs: 100, duracaoMinimaMs: 0,
    aoAtividade: (t, i) => eventos.push([t, i]), ...opcoes,
  });
  // O áudio termina no instante 10000 ms; cada bloco chega no fim dos seus samples.
  const fimTotal = 10000;
  const totalMs = (audio.length / 2 / HZ) * 1000;
  const t0 = fimTotal - totalMs;
  let pos = 0;
  while (pos < audio.length) {
    const tam = tamanhos === 'todo' ? audio.length : tamanhos;
    const bloco = audio.subarray(pos, pos + tam);
    pos += bloco.length;
    d.processar(bloco, t0 + (Math.floor(pos / 2) / HZ) * 1000);
  }
  return { eventos, t0 };
}

test('senoide alta dispara', () => {
  const { eventos } = rodar(pcm([{ ms: 500, amp: 0.5 }]), 'todo');
  assert.ok(eventos.length > 0);
});

test('silêncio e ruído baixo não disparam', () => {
  assert.equal(rodar(pcm([{ ms: 1000, amp: 0 }]), 'todo').eventos.length, 0);
  // senoide de pico 0.003 fica perto de -50 dBFS, abaixo de -30
  assert.equal(rodar(pcm([{ ms: 1000, amp: 0.003 }]), 'todo').eventos.length, 0);
});

test('clique de 50 ms não vale com duração mínima de 200 ms', () => {
  const audio = pcm([{ ms: 500 }, { ms: 50, amp: 0.5 }, { ms: 500 }]);
  const { eventos } = rodar(audio, 'todo', { janelaMs: 50, duracaoMinimaMs: 200 });
  assert.equal(eventos.length, 0);
});

test('som de 500 ms dispara com o início do som', () => {
  const audio = pcm([{ ms: 1000 }, { ms: 500, amp: 0.5 }, { ms: 1000 }]);
  const { eventos, t0 } = rodar(audio, 'todo', { duracaoMinimaMs: 200 });
  assert.ok(eventos.length >= 1);
  assert.ok(Math.abs(eventos[0][0] - (t0 + 1000)) <= 100, `inicio ${eventos[0][0] - t0}`);
});

test('tamanho do bloco não muda o resultado', () => {
  const audio = pcm([{ ms: 700 }, { ms: 600, amp: 0.5 }, { ms: 700 }, { ms: 300, amp: 0.2 }]);
  const ref = rodar(audio, 'todo', { duracaoMinimaMs: 200 }).eventos;
  assert.ok(ref.length > 0);
  for (const tam of [1, 333, 4097]) {
    const r = rodar(audio, tam, { duracaoMinimaMs: 200 }).eventos;
    assert.equal(r.length, ref.length, `tam ${tam}`);
    r.forEach(([t, i], k) => {
      assert.ok(Math.abs(t - ref[k][0]) < 1e-6, `tam ${tam} t`);
      assert.ok(Math.abs(i - ref[k][1]) < 1e-9, `tam ${tam} i`);
    });
  }
});

test('intensidade fica em 0..1 e cresce com o volume', () => {
  const baixo = rodar(pcm([{ ms: 300, amp: 0.1 }]), 'todo').eventos;
  const alto = rodar(pcm([{ ms: 300, amp: 0.8 }]), 'todo').eventos;
  for (const [, i] of [...baixo, ...alto]) assert.ok(i >= 0 && i <= 1);
  assert.ok(alto[0][1] > baixo[0][1]);
});

test('aoAtividade que lança erro não quebra o processar', () => {
  const d = criarDetectorSom({
    hz: HZ, limiarDb: -30, janelaMs: 100, duracaoMinimaMs: 0,
    aoAtividade: () => { throw new Error('x'); },
  });
  assert.doesNotThrow(() => d.processar(pcm([{ ms: 300, amp: 0.5 }]), 1000));
});

test('som de exatamente a duração mínima gera atividade do início ao fim da última janela', async () => {
  const { criarDetectorSom } = await import('../src/deteccao/som.js');
  const hz = 16000;
  const t = [];
  const d = criarDetectorSom({ hz, limiarDb: -30, janelaMs: 100, duracaoMinimaMs: 200, aoAtividade: (x) => t.push(x) });
  const b = Buffer.alloc(hz * 0.2 * 2);
  for (let i = 0; i < hz * 0.2; i++) b.writeInt16LE(Math.round(16000 * Math.sin(2 * Math.PI * 440 * i / hz)), i * 2);
  d.processar(b, 1200);
  assert.ok(t.length >= 2);
  assert.ok(Math.abs(Math.min(...t) - 1000) < 1);
  assert.ok(Math.abs(Math.max(...t) - 1200) < 1);
});
