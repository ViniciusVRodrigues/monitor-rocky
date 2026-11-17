import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { criarDistribuidor } from '../src/distribuidor.js';

function escritaFalsa({ cheia = false } = {}) {
  const w = new EventEmitter();
  w.recebidos = [];
  w.write = (b) => { w.recebidos.push(b); return !cheia; };
  return w;
}

test('entrega cada bloco a todos os inscritos e permite cancelar', () => {
  const d = criarDistribuidor();
  const a = [], b = [];
  const cancelarA = d.inscrever((x) => a.push(x));
  d.inscrever((x) => b.push(x));
  d.publicar(Buffer.from('1'));
  cancelarA();
  d.publicar(Buffer.from('2'));
  assert.equal(a.length, 1);
  assert.equal(b.length, 2);
  assert.equal(d.ouvintes(), 1);
});

test('publicar sem ninguém inscrito não falha', () => {
  assert.doesNotThrow(() => criarDistribuidor().publicar(Buffer.from('x')));
});

test('inscrito que lança erro não afeta os outros', () => {
  const d = criarDistribuidor();
  const b = [];
  d.inscrever(() => { throw new Error('quebrou'); });
  d.inscrever((x) => b.push(x));
  assert.doesNotThrow(() => d.publicar(Buffer.from('x')));
  assert.equal(b.length, 1);
});

test('escrita lenta descarta blocos até o dreno e os demais seguem', () => {
  const d = criarDistribuidor();
  const lenta = escritaFalsa({ cheia: true });
  const normal = [];
  d.ligarEscrita(lenta);
  d.inscrever((x) => normal.push(x));
  d.publicar(Buffer.from('1')); // write devolve false: marca cheia
  d.publicar(Buffer.from('2')); // descartado
  d.publicar(Buffer.from('3')); // descartado
  assert.equal(lenta.recebidos.length, 1);
  assert.equal(normal.length, 3);
  lenta.emit('drain');
  d.publicar(Buffer.from('4'));
  assert.equal(lenta.recebidos.length, 2);
});

test('erro na escrita (EPIPE do ffplay) cancela a inscrição sem lançar', () => {
  const d = criarDistribuidor();
  const w = escritaFalsa();
  d.ligarEscrita(w);
  assert.equal(d.ouvintes(), 1);
  assert.doesNotThrow(() => w.emit('error', new Error('EPIPE')));
  assert.equal(d.ouvintes(), 0);
});
