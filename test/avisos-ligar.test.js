import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ligarAvisoSom } from '../src/avisos/ligar.js';

function cenario({ quantas = 1, cfg = {}, agora } = {}) {
  let ouvinte = null;
  const det = { aoSomLongo(fn) { ouvinte = fn; return () => { ouvinte = null; }; } };
  const enviados = [];
  const avisos = { ligado: true, quantas: () => quantas, enviarTodos: async (p) => { enviados.push(p); return { enviados: 1 }; } };
  let t = agora ?? new Date(2026, 10, 18, 14, 32, 0);
  const cancelar = ligarAvisoSom({
    det, avisos, log: () => {}, agora: () => t,
    cfg: { avisoSomSegundos: 20, avisoIntervaloMinutos: 10, avisoSilencioInicio: '', avisoSilencioFim: '', ...cfg },
  });
  return {
    enviados, cancelar,
    disparar: (inicio = t.getTime() - 20000) => ouvinte?.({ inicio, duracaoMs: 20000 }),
    avancar: (ms) => { t = new Date(t.getTime() + ms); },
    ouvinte: () => ouvinte,
  };
}

test('som longo envia o aviso com o texto e a hora do início', async () => {
  const c = cenario();
  await c.disparar(new Date(2026, 10, 18, 14, 31, 40).getTime());
  assert.deepEqual(c.enviados, [{ titulo: 'Rocky', corpo: 'Barulho há 20 s seguidos (14:31). Toque para ver.', url: '/', tag: 'rocky-som' }]);
});

test('intervalo mínimo: segundo som dentro de 10 min não avisa; depois avisa', async () => {
  const c = cenario();
  await c.disparar();
  c.avancar(9 * 60 * 1000);
  await c.disparar();
  assert.equal(c.enviados.length, 1);
  c.avancar(60 * 1000);
  await c.disparar();
  assert.equal(c.enviados.length, 2);
});

test('sem inscrição não envia e não gasta o intervalo', async () => {
  const c = cenario({ quantas: 0 });
  await c.disparar();
  assert.equal(c.enviados.length, 0);
});

test('silêncio bloqueia', async () => {
  const c = cenario({ cfg: { avisoSilencioInicio: '23:00', avisoSilencioFim: '07:00' }, agora: new Date(2026, 10, 18, 2, 0, 0) });
  await c.disparar();
  assert.equal(c.enviados.length, 0);
});

test('avisos desligados ou detecção sem aoSomLongo: não liga nada', () => {
  assert.equal(typeof ligarAvisoSom({ det: null, avisos: { ligado: true }, cfg: {} }), 'function');
  const c = { aoSomLongo() { throw new Error('não devia ligar'); } };
  assert.equal(typeof ligarAvisoSom({ det: c, avisos: { ligado: false }, cfg: {} }), 'function');
  assert.equal(typeof ligarAvisoSom({ det: c, avisos: undefined, cfg: {} }), 'function');
});

test('cancelar desliga o ouvinte', () => {
  const c = cenario();
  c.cancelar();
  assert.equal(c.ouvinte(), null);
});
