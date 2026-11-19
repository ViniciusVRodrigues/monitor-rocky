import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarRegra, textoAviso } from '../src/avisos/regra.js';

const h = (hh, mm, ss = 0, dia = 18) => new Date(2026, 10, dia, hh, mm, ss);
const MIN = 60 * 1000;

test('intervalo: 1º libera, 2º dentro do intervalo bloqueia, depois libera', () => {
  const r = criarRegra({ intervaloMs: 10 * MIN });
  assert.equal(r.permitir(h(12, 0)), true);
  assert.equal(r.permitir(h(12, 5)), false);
  assert.equal(r.permitir(h(12, 9, 59)), false);
  assert.equal(r.permitir(h(12, 10)), true);
  assert.equal(r.permitir(h(12, 11)), false); // o intervalo conta do último permitido
});

test('silêncio 23:00-07:00 cruza a meia-noite', () => {
  const r = criarRegra({ intervaloMs: 0, silencioInicio: '23:00', silencioFim: '07:00' });
  assert.equal(r.permitir(h(23, 30)), false);
  assert.equal(r.permitir(h(23, 0)), false);
  assert.equal(r.permitir(h(2, 0)), false);
  assert.equal(r.permitir(h(6, 59)), false);
  assert.equal(r.permitir(h(7, 0)), true);
  assert.equal(r.permitir(h(22, 59)), true);
  assert.equal(r.permitir(h(12, 0)), true);
});

test('silêncio diurno 13:00-14:00', () => {
  const r = criarRegra({ intervaloMs: 0, silencioInicio: '13:00', silencioFim: '14:00' });
  assert.equal(r.permitir(h(12, 59)), true);
  assert.equal(r.permitir(h(13, 0)), false);
  assert.equal(r.permitir(h(13, 59)), false);
  assert.equal(r.permitir(h(14, 0)), true);
});

test('silêncio vazio ou com início igual ao fim libera', () => {
  for (const [i, f] of [['', ''], ['08:00', '08:00']]) {
    const r = criarRegra({ intervaloMs: 0, silencioInicio: i, silencioFim: f });
    assert.equal(r.permitir(h(8, 0)), true);
    assert.equal(r.permitir(h(3, 0)), true);
    assert.equal(r.permitir(h(23, 59)), true);
  }
  const r = criarRegra({ intervaloMs: 0 });
  assert.equal(r.permitir(h(3, 0)), true);
});

test('bloqueio pelo silêncio não marca o último aviso', () => {
  // se 23:30 tivesse marcado, 07:00 (7,5 h depois) ainda estaria dentro das 8 h
  const r = criarRegra({ intervaloMs: 8 * 60 * MIN, silencioInicio: '23:00', silencioFim: '07:00' });
  assert.equal(r.permitir(h(23, 30)), false);
  assert.equal(r.permitir(h(7, 0, 0, 19)), true);
});

test('textoAviso: arredonda os segundos e usa a hora local com zero à esquerda', () => {
  const inicio = h(9, 5);
  assert.deepEqual(textoAviso({ segundos: 20, inicio }), {
    titulo: 'Rocky', corpo: 'Barulho há 20 s seguidos (09:05). Toque para ver.', url: '/', tag: 'rocky-som',
  });
  assert.equal(textoAviso({ segundos: 19.6, inicio }).corpo, 'Barulho há 20 s seguidos (09:05). Toque para ver.');
  assert.match(textoAviso({ segundos: 19.4, inicio: h(14, 32) }).corpo, /há 19 s seguidos \(14:32\)/);
});
