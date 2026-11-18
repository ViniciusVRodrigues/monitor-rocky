import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarRecolher, textoTrilho } from '../web/js/recolher.js';

function montar({ salvo = null, largo = true } = {}) {
  const ouvintes = {};
  const botao = {
    attrs: {}, textContent: '', title: '',
    setAttribute(k, v) { this.attrs[k] = String(v); },
    addEventListener(ev, f) { ouvintes[ev] = f; },
  };
  const rotulo = { textContent: '' };
  botao.querySelector = () => rotulo;
  const painel = { hidden: false };
  const classes = new Set();
  const raiz = { classList: { toggle: (c, v) => (v ? classes.add(c) : classes.delete(c)) } };
  const mqOuv = [];
  const mq = { matches: largo, addEventListener: (_e, f) => mqOuv.push(f) };
  const guardado = { valor: salvo };
  const armazenamento = {
    ler: () => guardado.valor,
    gravar: (v) => { guardado.valor = v; },
  };
  const r = criarRecolher({ botao, painel, raiz, mq, armazenamento });
  return {
    r, botao, rotulo, painel, classes, guardado,
    clicar: () => ouvintes.click(),
    mudarLargura: (v) => { mq.matches = v; for (const f of mqOuv) f(); },
  };
}

test('texto do trilho: aberto, recolhido e com eventos novos', () => {
  assert.equal(textoTrilho({ recolhida: false, novos: 0 }), 'Recolher linha do tempo');
  assert.equal(textoTrilho({ recolhida: true, novos: 0 }), 'Linha do tempo');
  assert.equal(textoTrilho({ recolhida: true, novos: 1 }), 'Linha do tempo · 1 evento novo');
  assert.equal(textoTrilho({ recolhida: true, novos: 3 }), 'Linha do tempo · 3 eventos novos');
});

test('primeiro uso abre; recolher esconde o painel, marca a página e lembra no aparelho', () => {
  const m = montar();
  assert.equal(m.painel.hidden, false);
  assert.equal(m.botao.attrs['aria-expanded'], 'true');
  assert.equal(m.classes.has('dia-recolhida'), false);
  m.clicar();
  assert.equal(m.painel.hidden, true);
  assert.equal(m.botao.attrs['aria-expanded'], 'false');
  assert.equal(m.classes.has('dia-recolhida'), true);
  assert.equal(m.guardado.valor, 'recolhida');
  assert.equal(m.rotulo.textContent, 'Linha do tempo');
  m.clicar();
  assert.equal(m.painel.hidden, false);
  assert.equal(m.guardado.valor, 'aberta');
});

test('a escolha salva volta ao recarregar', () => {
  const m = montar({ salvo: 'recolhida' });
  assert.equal(m.painel.hidden, true);
  assert.equal(m.classes.has('dia-recolhida'), true);
  assert.equal(montar({ salvo: 'lixo' }).painel.hidden, false);
});

test('eventos novos contam só com a linha do tempo recolhida e zeram ao abrir', () => {
  const m = montar();
  m.r.eventoNovo();
  assert.equal(m.rotulo.textContent, 'Recolher linha do tempo');
  m.clicar();
  m.r.eventoNovo();
  m.r.eventoNovo();
  assert.equal(m.rotulo.textContent, 'Linha do tempo · 2 eventos novos');
  m.clicar();
  m.clicar();
  assert.equal(m.rotulo.textContent, 'Linha do tempo');
});

test('tela estreita (< 1024): o painel sempre aparece, mesmo com a escolha recolhida', () => {
  const m = montar({ salvo: 'recolhida', largo: false });
  assert.equal(m.painel.hidden, false);
  assert.equal(m.classes.has('dia-recolhida'), false);
  m.mudarLargura(true);
  assert.equal(m.painel.hidden, true);
  assert.equal(m.classes.has('dia-recolhida'), true);
  m.mudarLargura(false);
  assert.equal(m.painel.hidden, false);
  assert.equal(m.guardado.valor, 'recolhida'); // a escolha não se perde
});
