import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { vigiar, vigiarPai } from '../src/vigia.js';

function filho() {
  const f = new EventEmitter();
  f.stdin = { write() {}, end() {} };
  f.stdout = new EventEmitter();
  f.stderr = new EventEmitter();
  f.pid = 1234;
  return f;
}
const tick = () => new Promise((r) => setImmediate(r));

test('reinicia o monitor com espera crescente, manda a saída ao log e à saúde', async () => {
  const filhos = []; const esperas = []; const linhas = []; const saude = [];
  const v = vigiar({
    comando: 'node', args: ['src/captura.js'],
    log: (m) => linhas.push(m), aoLinha: (l) => saude.push(l),
    esperaInicialMs: 2000, esperaMaxMs: 8000, intervaloMinimoMs: 0,
    iniciarProcesso: () => { const f = filho(); filhos.push(f); return f; },
    esperar: (ms) => { esperas.push(ms); return Promise.resolve(); },
    encerrarProcesso: async (f) => { f.emit('exit', 0, null); },
  });
  for (let i = 0; i < 4; i++) {
    await tick();
    filhos[i].stdout.emit('data', Buffer.from('ffmpeg saiu com código 1. Reiniciando em 1 s.\nsegunda linha\n'));
    filhos[i].emit('exit', 1, null);
    await tick();
  }
  assert.deepEqual(esperas.filter((e) => e >= 2000), [2000, 4000, 8000, 8000]);
  assert.ok(linhas.some((l) => l.includes('saiu com código 1')));
  assert.equal(saude.filter((l) => l.includes('ffmpeg saiu')).length, 4);
  assert.ok(saude.includes('segunda linha'));
  await v.parar();
});

test('junta pedaços de linha entre blocos', async () => {
  const filhos = []; const saude = [];
  const v = vigiar({
    comando: 'node', args: [], log: () => {}, aoLinha: (l) => saude.push(l), intervaloMinimoMs: 0,
    iniciarProcesso: () => { const f = filho(); filhos.push(f); return f; },
    esperar: () => Promise.resolve(), encerrarProcesso: async (f) => { f.emit('exit', 0, null); },
  });
  await tick();
  filhos[0].stdout.emit('data', Buffer.from('meia '));
  filhos[0].stdout.emit('data', Buffer.from('linha\nnova'));
  assert.deepEqual(saude, ['meia linha']);
  await v.parar();
});

test('aplica a prioridade configurada ao monitor logo depois de subir', async () => {
  const chamadas = [];
  const v = vigiar({
    comando: 'node', args: [], log: () => {}, intervaloMinimoMs: 0, prioridade: 'acima',
    definirPrioridade: (pid, valor) => chamadas.push([pid, valor]),
    iniciarProcesso: () => filho(),
    esperar: () => Promise.resolve(), encerrarProcesso: async (f) => { f.emit('exit', 0, null); },
  });
  await tick();
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0][0], 1234);
  await v.parar();
});

test('vigiarPai: quando o processo pai (wscript da tarefa) some, chama aoPerder uma vez; enquanto vive, nada', () => {
  let vivo = true; const consultas = []; let perdeu = 0; let tique = null;
  const parar = vigiarPai({
    ppid: 77, vivo: (pid) => { consultas.push(pid); return vivo; }, aoPerder: () => { perdeu++; },
    agendar: (f) => { tique = f; return 'timer'; }, cancelar: (t) => { assert.equal(t, 'timer'); tique = null; },
  });
  tique(); tique();
  assert.equal(perdeu, 0);
  vivo = false;
  tique(); tique();
  assert.equal(perdeu, 1);
  assert.deepEqual(consultas.filter((p) => p !== 77), []);
  parar();
  assert.equal(tique, null);
});

test('vigiarPai: sem ppid válido não vigia nada', () => {
  let agendou = false;
  vigiarPai({ ppid: 0, vivo: () => false, aoPerder: () => assert.fail(), agendar: () => { agendou = true; } });
  assert.equal(agendou, false);
});
