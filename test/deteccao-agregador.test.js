import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarAgregador } from '../src/deteccao/agregador.js';

function criar(opcoes = {}) {
  const eventos = [];
  const a = criarAgregador({ tipo: 'som', juntarMs: 10000, maxMs: 120000, aoFechar: (e) => eventos.push(e), ...opcoes });
  return { a, eventos };
}

test('duas atividades a 4 s viram um evento', () => {
  const { a, eventos } = criar();
  a.atividade(1000, 0.2);
  a.atividade(5000, 0.4);
  assert.ok(a.aberto());
  a.verificar(20000);
  assert.equal(eventos.length, 1);
  assert.deepEqual(eventos[0], { tipo: 'som', inicio: 1000, fim: 5000, intensidade: 0.4, picoMs: 5000 });
  assert.ok(!a.aberto());
});

test('duas atividades a 15 s viram dois eventos', () => {
  const { a, eventos } = criar();
  a.atividade(1000, 0.5);
  a.atividade(16000, 0.3);
  a.encerrar();
  assert.equal(eventos.length, 2);
  assert.equal(eventos[0].fim, 1000);
  assert.equal(eventos[1].inicio, 16000);
});

test('ruído contínuo respeita o máximo', () => {
  const { a, eventos } = criar();
  for (let t = 0; t <= 300000; t += 1000) { a.atividade(t, 0.5); a.verificar(t); }
  a.encerrar();
  assert.ok(eventos.length >= 3);
  for (const e of eventos) assert.ok(e.fim - e.inicio <= 120000);
});

test('encerrar fecha o aberto e verificar sem atividade não faz nada', () => {
  const { a, eventos } = criar();
  a.verificar(5000);
  a.encerrar();
  assert.equal(eventos.length, 0);
  a.atividade(1000, 0.1);
  a.encerrar();
  assert.equal(eventos.length, 1);
  assert.ok(!a.aberto());
});

test('aoFechar que lança erro não quebra', () => {
  const a = criarAgregador({ tipo: 'som', juntarMs: 10, maxMs: 100, aoFechar: () => { throw new Error('x'); } });
  a.atividade(0, 1);
  assert.doesNotThrow(() => a.verificar(100));
  assert.ok(!a.aberto());
});
