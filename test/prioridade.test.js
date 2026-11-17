import { test } from 'node:test';
import assert from 'node:assert/strict';
import { constants } from 'node:os';
import { mapearPrioridade, aplicarPrioridade } from '../src/prioridade.js';

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
