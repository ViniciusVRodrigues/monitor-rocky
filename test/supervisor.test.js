import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { supervisionar } from '../src/supervisor.js';

function filho() {
  const f = new EventEmitter();
  f.stdin = { write() {}, end() {} };
  f.stderr = new EventEmitter();
  f.stdout = new EventEmitter();
  f.kill = () => { f.matado = true; setImmediate(() => f.emit('exit', null, 'SIGTERM')); };
  return f;
}

function cenario() {
  const filhos = [];
  const esperas = [];
  const logs = [];
  let agora = 0;
  const base = {
    comando: 'ffmpeg', args: ['-x'],
    iniciarProcesso: () => { const f = filho(); filhos.push(f); return f; },
    esperar: (ms) => { esperas.push(ms); return Promise.resolve(); },
    log: (m) => logs.push(m),
    relogio: () => agora,
    esperarSaidaMs: 10,
    intervaloMinimoMs: 0,
  };
  return { filhos, esperas, logs, base, avancar: (ms) => { agora += ms; } };
}
const tick = () => new Promise((r) => setImmediate(r));

test('reinicia após queda, com espera crescente até o teto, e registra o código', async () => {
  const c = cenario();
  const s = supervisionar({ ...c.base, esperaInicialMs: 1000, esperaMaxMs: 4000 });
  for (let i = 0; i < 5; i++) {
    await tick();
    c.filhos[i].emit('exit', 1, null);
    await tick();
  }
  assert.deepEqual(c.esperas, [1000, 2000, 4000, 4000, 4000]);
  assert.equal(c.filhos.length, 6);
  assert.ok(c.logs.some((m) => m.includes('código 1')));
  await s.parar();
});

test('zera a espera depois de rodar estável', async () => {
  const c = cenario();
  const s = supervisionar({ ...c.base, esperaInicialMs: 1000, esperaMaxMs: 60000, estavelMs: 30000 });
  await tick();
  c.filhos[0].emit('exit', 1, null);
  await tick();
  c.avancar(31000);
  c.filhos[1].emit('exit', 1, null);
  await tick();
  assert.deepEqual(c.esperas, [1000, 1000]);
  await s.parar();
});

test('parar não reinicia o processo', async () => {
  const c = cenario();
  const s = supervisionar({ ...c.base, esperarSaidaMs: 50 });
  await tick();
  const p = s.parar();
  c.filhos[0].emit('exit', 0, null);
  await p;
  await tick();
  assert.equal(c.filhos.length, 1);
  assert.deepEqual(c.esperas, []);
});

test('chama antesDeIniciar a cada partida', async () => {
  const c = cenario();
  let n = 0;
  const s = supervisionar({ ...c.base, antesDeIniciar: () => { n++; } });
  await tick();
  c.filhos[0].emit('exit', 1, null);
  await tick();
  assert.equal(n, 2);
  await s.parar();
});

test('args pode ser função, chamada a cada partida', async () => {
  const c = cenario();
  const usados = [];
  let n = 0;
  const s = supervisionar({ ...c.base, args: () => { usados.push(++n); return ['-n', String(n)]; }, iniciarProcesso: (cmd, a) => { usados.push(a.join(' ')); const f = filho(); c.filhos.push(f); return f; } });
  await tick();
  c.filhos[0].emit('exit', 1, null);
  await tick();
  assert.deepEqual(usados, [1, '-n 1', 2, '-n 2']);
  await s.parar();
});

test('o stdout é sempre consumido e entregue a aoSaida', async () => {
  const c = cenario();
  const vistos = [];
  const s = supervisionar({ ...c.base, aoSaida: (b) => vistos.push(String(b)) });
  await tick();
  c.filhos[0].stdout.emit('data', Buffer.from('pcm'));
  assert.deepEqual(vistos, ['pcm']);
  await s.parar();
});

test('reiniciar encerra o processo e sobe outro sem backoff', async () => {
  const c = cenario();
  const s = supervisionar({ ...c.base });
  await tick();
  const r = s.reiniciar();
  c.filhos[0].emit('exit', 0, null);
  await r;
  await tick();
  assert.equal(c.filhos.length, 2);
  assert.deepEqual(c.esperas, []);
  await s.parar();
});

test('definirAtivo(false) para sem reiniciar; definirAtivo(true) volta', async () => {
  const c = cenario();
  const s = supervisionar({ ...c.base });
  await tick();
  const r = s.definirAtivo(false);
  c.filhos[0].emit('exit', 0, null);
  await r;
  await tick();
  assert.equal(c.filhos.length, 1);
  await s.definirAtivo(true);
  await tick();
  assert.equal(c.filhos.length, 2);
  await s.parar();
});

test('respeita o intervalo mínimo entre partidas', async () => {
  const c = cenario();
  const s = supervisionar({ ...c.base, intervaloMinimoMs: 1100 });
  await tick();
  const r = s.reiniciar();
  c.filhos[0].emit('exit', 0, null);
  await r;
  await tick();
  assert.ok(c.esperas.includes(1100));
  await s.parar();
});

import { constants } from 'node:os';

test('prioridade: chama definirPrioridade(pid, constante) depois do spawn; inválida não chama; falha só loga', async () => {
  const casos = [['normal', constants.priority.PRIORITY_NORMAL], ['acima', constants.priority.PRIORITY_ABOVE_NORMAL], ['alta', constants.priority.PRIORITY_HIGH]];
  for (const [nome, valor] of casos) {
    const c = cenario();
    const chamadas = [];
    const s = supervisionar({ ...c.base, prioridade: nome, definirPrioridade: (p, v) => chamadas.push([p, v]),
      iniciarProcesso: () => { const f = filho(); f.pid = 4321; c.filhos.push(f); return f; } });
    await tick();
    assert.deepEqual(chamadas, [[4321, valor]]);
    await s.parar();
  }
  for (const ruim of [undefined, 'tempo-real', 'xyz', 3]) {
    const c = cenario();
    const chamadas = [];
    const s = supervisionar({ ...c.base, prioridade: ruim, definirPrioridade: (p, v) => chamadas.push([p, v]),
      iniciarProcesso: () => { const f = filho(); f.pid = 1; c.filhos.push(f); return f; } });
    await tick();
    assert.deepEqual(chamadas, []);
    await s.parar();
  }
  const c = cenario();
  const s = supervisionar({ ...c.base, prioridade: 'alta', definirPrioridade: () => { throw new Error('sem permissão'); },
    iniciarProcesso: () => { const f = filho(); f.pid = 7; c.filhos.push(f); return f; } });
  await tick();
  assert.ok(c.logs.some((l) => /prioridade/i.test(l) && /sem permissão/.test(l)));
  assert.equal(c.filhos.length, 1);
  await s.parar();
});

test('stderr: chunk cortado no meio vira uma linha só; resto sai no exit', async () => {
  const c = cenario();
  const s = supervisionar({ ...c.base });
  await tick();
  c.filhos[0].stderr.emit('data', 'frame dro');
  c.filhos[0].stderr.emit('data', 'pped\nsegunda\nterce');
  assert.deepEqual(c.logs.filter((l) => l.startsWith('[ffmpeg]')), ['[ffmpeg] frame dropped', '[ffmpeg] segunda']);
  c.filhos[0].emit('exit', 1, null);
  await tick();
  assert.ok(c.logs.includes('[ffmpeg] terce'));
  await s.parar();
});

test('stderr: janela limita linhas e conta as omitidas na janela seguinte', async () => {
  const c = cenario();
  const s = supervisionar({ ...c.base, logJanelaSegundos: 10, logLinhasPorJanela: 20 });
  await tick();
  let texto = '';
  for (let i = 0; i < 25; i++) texto += `erro distinto ${i}\n`;
  c.filhos[0].stderr.emit('data', texto);
  assert.equal(c.logs.filter((l) => l.startsWith('[ffmpeg] erro')).length, 20);
  assert.ok(!c.logs.some((l) => /omitidas/.test(l)));
  c.avancar(10000);
  c.filhos[0].stderr.emit('data', 'nova janela\n');
  const i = c.logs.findIndex((l) => l === '[ffmpeg] 5 linhas omitidas');
  assert.ok(i >= 0);
  assert.equal(c.logs[i + 1], '[ffmpeg] nova janela');
  await s.parar();
});

test('stderr: linhas idênticas seguidas saem uma vez, com "(repetida N vezes)" quando muda', async () => {
  const c = cenario();
  const s = supervisionar({ ...c.base });
  await tick();
  c.filhos[0].stderr.emit('data', 'frame dropped\nframe dropped\nframe dropped\nframe dropped\noutra\n');
  const l = c.logs.filter((x) => x.startsWith('[ffmpeg]'));
  assert.deepEqual(l, ['[ffmpeg] frame dropped', '[ffmpeg] (repetida 3 vezes)', '[ffmpeg] outra']);
  await s.parar();
});

test('prioridade abaixo também é aceita', async () => {
  const c = cenario();
  const ch = [];
  const s = supervisionar({ ...c.base, prioridade: 'abaixo', definirPrioridade: (p, v) => ch.push([p, v]),
    iniciarProcesso: () => { const f = filho(); f.pid = 5; c.filhos.push(f); return f; } });
  await tick();
  assert.deepEqual(ch, [[5, constants.priority.PRIORITY_BELOW_NORMAL]]);
  await s.parar();
});

test('stderr: rename do playlist HLS negado (leitor segurando o arquivo no Windows) não vai ao log, só é contado', async () => {
  const c = cenario();
  const s = supervisionar({ ...c.base });
  await tick();
  const aviso = '[hls @ 000002cc98388fc0] failed to rename file aovivo/index.m3u8.tmp to aovivo/index.m3u8: Operation not permitted\n';
  c.filhos[0].stderr.emit('data', `${aviso}${aviso}outra coisa\n`);
  assert.deepEqual(c.logs.filter((l) => l.startsWith('[ffmpeg]')), ['[ffmpeg] outra coisa']);
  c.filhos[0].emit('exit', 1, null);
  await tick();
  assert.ok(c.logs.some((l) => /2 avisos de rename do playlist HLS/.test(l)));
  // outro arquivo não renomeado continua aparecendo
  const c2 = cenario();
  const s2 = supervisionar({ ...c2.base });
  await tick();
  c2.filhos[0].stderr.emit('data', '[hls @ 1] failed to rename file x/seg1.ts.tmp to x/seg1.ts: No such file\n');
  assert.equal(c2.logs.filter((l) => l.startsWith('[ffmpeg]')).length, 1);
  await s.parar(); await s2.parar();
});
