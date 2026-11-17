import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isoLocal, nomeDia, nomeHora } from '../src/deteccao/tempo.js';
import { configDeteccao, PADROES } from '../src/deteccao/config.js';
import { ConfigErro } from '../src/config.js';

test('isoLocal: hora local com fuso, sem Z nem milissegundos', () => {
  const d = new Date(2026, 10, 17, 14, 3, 5, 789);
  const s = isoLocal(d);
  assert.match(s, /^2026-11-17T14:03:05[+-]\d{2}:\d{2}$/);
  assert.equal(new Date(s).getTime(), new Date(2026, 10, 17, 14, 3, 5).getTime());
});

test('nomeDia e nomeHora em hora local', () => {
  const d = new Date(2026, 0, 2, 3, 4, 5);
  assert.equal(nomeDia(d), '2026-01-02');
  assert.equal(nomeHora(d), '03-04-05');
});

test('configDeteccao: aplica padrões e respeita a config', () => {
  const c = configDeteccao({ resolucao: '1280x720', somLimiarDb: -40 });
  assert.equal(c.somLimiarDb, -40);
  assert.equal(c.clipesDias, PADROES.clipesDias);
  assert.equal(c.eventoPreSegundos, 5);
});

test('configDeteccao: valores inválidos dão ConfigErro em pt-BR', () => {
  const casos = [
    { somLimiarDb: 3 }, { movimentoAreaMinima: 0 }, { movimentoAreaMinima: 2 },
    { eventoJuntarSegundos: 0 }, { clipesDias: -1 }, { clipesDias: 1e9 }, { clipesDias: 1.5 }, { movimentoLimiarPixel: 300 }, { resolucao: 'grande' },
  ];
  for (const extra of casos) {
    assert.throws(() => configDeteccao({ resolucao: '1280x720', ...extra }), (e) => e instanceof ConfigErro && /inválida/.test(e.message), JSON.stringify(extra));
  }
});

test('configDeteccao: clipesDias 0 é aceito (nunca apagar)', () => {
  assert.equal(configDeteccao({ resolucao: '1280x720', clipesDias: 0 }).clipesDias, 0);
});
