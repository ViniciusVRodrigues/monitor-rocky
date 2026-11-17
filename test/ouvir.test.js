import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { criarDistribuidor } from '../src/distribuidor.js';
import { criarOuvinte, argsOuvir } from '../src/ouvir.js';

function procFalso() {
  const p = new EventEmitter();
  p.recebidos = [];
  p.stdin = new EventEmitter();
  p.stdin.write = (b) => { p.recebidos.push(b); return true; };
  p.stdin.end = () => {};
  p.kill = () => setImmediate(() => p.emit('exit', null, 'SIGTERM'));
  return p;
}

test('argsOuvir usa a taxa do áudio ao vivo e baixa latência', () => {
  const a = argsOuvir({ ouvirHz: 16000, ouvirArgs: ['-volume', '50'] }).join(' ');
  assert.match(a, /-nodisp/);
  assert.match(a, /-f s16le/);
  assert.match(a, /-sample_rate 16000/);
  assert.match(a, /-fflags nobuffer/);
  assert.match(a, /-volume 50/);
  assert.match(a, /-i pipe:0$|-i pipe:0 /);
});

test('ligar inicia o player e alimenta com o áudio; desligar encerra e solta o distribuidor', async () => {
  const d = criarDistribuidor();
  const procs = [];
  const o = criarOuvinte({ cfg: { ouvirComando: 'ffplay', ouvirHz: 16000 }, distribuidor: d, log: () => {}, iniciarProcesso: () => { const p = procFalso(); procs.push(p); return p; } });
  assert.equal(o.ativo(), false);
  o.ligar();
  assert.equal(o.ativo(), true);
  d.publicar(Buffer.from('abc'));
  assert.equal(procs[0].recebidos.length, 1);
  o.ligar(); // idempotente
  assert.equal(procs.length, 1);
  await o.desligar();
  assert.equal(o.ativo(), false);
  assert.equal(d.ouvintes(), 0);
});

test('se o player morrer sozinho, volta a desligado', async () => {
  const d = criarDistribuidor();
  let p;
  const o = criarOuvinte({ cfg: { ouvirComando: 'ffplay', ouvirHz: 16000 }, distribuidor: d, log: () => {}, iniciarProcesso: () => (p = procFalso()) });
  o.ligar();
  p.emit('exit', 1, null);
  assert.equal(o.ativo(), false);
  assert.equal(d.ouvintes(), 0);
});

test('player inexistente não derruba o programa', () => {
  const d = criarDistribuidor();
  let p;
  const o = criarOuvinte({ cfg: { ouvirComando: 'nao-existe', ouvirHz: 16000 }, distribuidor: d, log: () => {}, iniciarProcesso: () => (p = procFalso()) });
  o.ligar();
  assert.doesNotThrow(() => p.emit('error', new Error('ENOENT')));
  assert.equal(o.ativo(), false);
});
