import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { anexarRegistro, caminhosEvento, limparClipes, montarRegistro } from '../src/deteccao/registro.js';

function pastaTemp() { return mkdtempSync(join(tmpdir(), 'rocky-reg-')); }

test('caminhosEvento: nome pelo início − pré, pasta criada, sufixo -2/-3', () => {
  const pasta = pastaTemp();
  try {
    const ini = new Date(2026, 10, 17, 14, 3, 5).getTime();
    const evento = { tipo: 'som', inicio: ini, fim: ini + 4000 };
    const a = caminhosEvento({ pasta, evento, preMs: 5000 });
    assert.equal(a.id, '2026-11-17_14-03-00-som');
    assert.equal(a.dia, '2026-11-17');
    assert.equal(a.relClipe, 'clipes/2026-11-17/14-03-00-som.mp4');
    assert.equal(a.relMiniatura, 'clipes/2026-11-17/14-03-00-som.jpg');
    assert.equal(a.base, join(pasta, 'clipes', '2026-11-17', '14-03-00-som'));
    assert.ok(existsSync(join(pasta, 'clipes', '2026-11-17')));
    writeFileSync(`${a.base}.mp4`, 'x');
    const b = caminhosEvento({ pasta, evento, preMs: 5000 });
    assert.equal(b.id, '2026-11-17_14-03-00-som-2');
    assert.equal(b.relClipe, 'clipes/2026-11-17/14-03-00-som-2.mp4');
    writeFileSync(`${b.base}.mp4`, 'x');
    assert.equal(caminhosEvento({ pasta, evento, preMs: 5000 }).id, '2026-11-17_14-03-00-som-3');
  } finally { rmSync(pasta, { recursive: true, force: true }); }
});

test('caminhosEvento: o pré pode virar o dia anterior', () => {
  const pasta = pastaTemp();
  try {
    const ini = new Date(2026, 10, 17, 0, 0, 2).getTime();
    const c = caminhosEvento({ pasta, evento: { tipo: 'movimento', inicio: ini, fim: ini + 1000 }, preMs: 5000 });
    assert.equal(c.dia, '2026-11-16');
    assert.equal(c.id, '2026-11-16_23-59-57-movimento');
  } finally { rmSync(pasta, { recursive: true, force: true }); }
});

test('montarRegistro: exatamente as 7 chaves do contrato', () => {
  const ini = new Date(2026, 10, 17, 14, 3, 5, 700).getTime();
  const r = montarRegistro({
    id: 'x', evento: { tipo: 'som', inicio: ini, fim: ini + 9000, intensidade: 0.123456 },
    clipe: 'clipes/2026-11-17/a.mp4', miniatura: null,
  });
  assert.deepEqual(Object.keys(r), ['id', 'inicio', 'fim', 'tipo', 'intensidade', 'clipe', 'miniatura']);
  assert.match(r.inicio, /^2026-11-17T14:03:05[+-]\d{2}:\d{2}$/);
  assert.match(r.fim, /^2026-11-17T14:03:14[+-]\d{2}:\d{2}$/);
  assert.ok(!r.inicio.includes('Z') && !r.inicio.includes('.'));
  assert.equal(r.intensidade, 0.123);
  assert.equal(r.miniatura, null);
  const alto = montarRegistro({ id: 'x', evento: { tipo: 'som', inicio: ini, fim: ini, intensidade: 7 } });
  assert.equal(alto.intensidade, 1);
  assert.equal(alto.clipe, null);
  assert.equal(montarRegistro({ id: 'x', evento: { tipo: 'som', inicio: ini, fim: ini, intensidade: -2 } }).intensidade, 0);
});

test('anexarRegistro: uma linha JSON por chamada', () => {
  const pasta = pastaTemp();
  try {
    const ev = { tipo: 'som', inicio: Date.now(), fim: Date.now() + 1000, intensidade: 0.5 };
    anexarRegistro(pasta, '2026-11-17', montarRegistro({ id: 'a', evento: ev }));
    anexarRegistro(pasta, '2026-11-17', montarRegistro({ id: 'b', evento: ev }));
    const linhas = readFileSync(join(pasta, 'eventos', '2026-11-17.jsonl'), 'utf8').split('\n');
    assert.equal(linhas.length, 3);
    assert.equal(linhas[2], '');
    assert.deepEqual([JSON.parse(linhas[0]).id, JSON.parse(linhas[1]).id], ['a', 'b']);
  } finally { rmSync(pasta, { recursive: true, force: true }); }
});

test('limparClipes: apaga o velho, mantém o recente, não toca em trechos/', () => {
  const pasta = pastaTemp();
  try {
    const agora = new Date(2026, 10, 17, 12, 0, 0);
    const mk = (rel, conteudo = 'x') => {
      const p = join(pasta, ...rel.split('/'));
      mkdirSync(join(p, '..'), { recursive: true });
      writeFileSync(p, conteudo);
      return p;
    };
    // 17/11 − 31 dias = 17/10; − 29 dias = 19/10; limite com dias=30 é 18/10.
    const velhoClipe = mk('clipes/2026-10-17/10-00-00-som.mp4');
    const velhoJpg = mk('clipes/2026-10-17/10-00-00-movimento.jpg');
    const velhoJsonl = mk('eventos/2026-10-17.jsonl');
    const novoClipe = mk('clipes/2026-10-19/10-00-00-som.mp4');
    const novoJsonl = mk('eventos/2026-10-19.jsonl');
    const trechoVelho = mk('trechos/2026-01-01/00-00-00.mp4');
    const estranho = mk('clipes/outra-coisa/a.mp4');
    const estranhoJsonl = mk('eventos/notas.jsonl');
    const logs = [];

    const r = limparClipes({ pasta, dias: 30, agora, log: (m) => logs.push(m) });
    assert.equal(r.apagados, 2);
    assert.ok(!existsSync(velhoClipe) && !existsSync(velhoJpg) && !existsSync(join(pasta, 'clipes', '2026-10-17')));
    assert.ok(!existsSync(velhoJsonl));
    for (const p of [novoClipe, novoJsonl, trechoVelho, estranho, estranhoJsonl]) assert.ok(existsSync(p), p);
    assert.equal(logs.length, 1);
  } finally { rmSync(pasta, { recursive: true, force: true }); }
});

test('limparClipes: dias = 0 não apaga nada; pasta inexistente não quebra', () => {
  const pasta = pastaTemp();
  try {
    const p = join(pasta, 'clipes', '2020-01-01');
    mkdirSync(p, { recursive: true });
    writeFileSync(join(p, 'a.mp4'), 'x');
    assert.deepEqual(limparClipes({ pasta, dias: 0 }), { apagados: 0 });
    assert.ok(existsSync(join(p, 'a.mp4')));
    assert.deepEqual(limparClipes({ pasta: join(pasta, 'nada'), dias: 30 }), { apagados: 0 });
  } finally { rmSync(pasta, { recursive: true, force: true }); }
});

test('limparClipes: dias absurdo (data inválida) não apaga nada', () => {
  const pasta = mkdtempSync(join(tmpdir(), 'rocky reg '));
  try {
    mkdirSync(join(pasta, 'clipes', '2099-01-01'), { recursive: true });
    mkdirSync(join(pasta, 'eventos'), { recursive: true });
    writeFileSync(join(pasta, 'eventos', '2020-01-01.jsonl'), '{}\n');
    assert.deepEqual(limparClipes({ pasta, dias: 1e9 }), { apagados: 0 });
    assert.ok(existsSync(join(pasta, 'clipes', '2099-01-01')));
    assert.ok(existsSync(join(pasta, 'eventos', '2020-01-01.jsonl')));
  } finally { rmSync(pasta, { recursive: true, force: true }); }
});

test('caminhosEvento: id não se repete quando o recorte anterior falhou (sem .mp4)', () => {
  const pasta = mkdtempSync(join(tmpdir(), 'rocky-reg-'));
  try {
    const evento = { tipo: 'som', inicio: new Date(2026, 10, 17, 15, 0, 5).getTime(), fim: 0 };
    const a = caminhosEvento({ pasta, evento, preMs: 5000 });
    const b = caminhosEvento({ pasta, evento, preMs: 5000 });
    assert.notEqual(a.id, b.id);
  } finally { rmSync(pasta, { recursive: true, force: true }); }
});
