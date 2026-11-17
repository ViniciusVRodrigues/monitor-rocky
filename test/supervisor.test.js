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
