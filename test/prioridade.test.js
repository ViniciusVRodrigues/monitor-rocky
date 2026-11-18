import { test } from 'node:test';
import assert from 'node:assert/strict';
import { constants } from 'node:os';
import { mapearPrioridade, aplicarPrioridade, prioridadeDaTarefa } from '../src/prioridade.js';

test('mapeia nomes e recusa o resto (nunca tempo real)', () => {
  const p = constants.priority;
  assert.equal(mapearPrioridade('abaixo'), p.PRIORITY_BELOW_NORMAL);
  assert.equal(mapearPrioridade('normal'), p.PRIORITY_NORMAL);
  assert.equal(mapearPrioridade('acima'), p.PRIORITY_ABOVE_NORMAL);
  assert.equal(mapearPrioridade('alta'), p.PRIORITY_HIGH);
  for (const x of ['tempo-real', 'realtime', undefined, null, 3, 'toString']) assert.equal(mapearPrioridade(x), undefined);
});

test('aplicarPrioridade: chama com pid e constante; falha só loga', () => {
  const ch = [];
  assert.equal(aplicarPrioridade({ pid: 9, nome: 'abaixo', definir: (p, v) => ch.push([p, v]) }), true);
  assert.deepEqual(ch, [[9, constants.priority.PRIORITY_BELOW_NORMAL]]);
  const logs = [];
  assert.equal(aplicarPrioridade({ pid: 9, nome: 'alta', definir: () => { throw new Error('negado'); }, log: (m) => logs.push(m) }), false);
  assert.match(logs[0], /negado/);
  assert.equal(aplicarPrioridade({ pid: 9, nome: 'x', definir: () => assert.fail() }), false);
});

test('prioridadeDaTarefa: faixa 0-10 do Agendador vira o nome do SO (nunca tempo real)', () => {
  const esperado = { 0: 'alta', 1: 'alta', 2: 'acima', 3: 'acima', 4: 'normal', 5: 'normal', 6: 'normal', 7: 'abaixo', 8: 'abaixo' };
  for (const [n, nome] of Object.entries(esperado)) assert.equal(prioridadeDaTarefa(Number(n)), nome, `prioridade ${n}`);
  // 9 e 10 seriam "ociosa": o node não usa; fica em "abaixo"
  assert.equal(prioridadeDaTarefa(9), 'abaixo');
  assert.equal(prioridadeDaTarefa(10), 'abaixo');
  for (const ruim of [11, -1, 2.5, 'x', null, undefined]) assert.equal(prioridadeDaTarefa(ruim), undefined);
});
