import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { anexarRegistro, caminhosEvento, limparClipes, limparPorEspaco, montarRegistro } from '../src/deteccao/registro.js';

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

// ---- retenção por espaço (ROCKY-9) ----
const GB = 1024 ** 3;
function montarDias(pasta, dias, bytes = 1000) {
  for (const d of dias) {
    mkdirSync(join(pasta, 'clipes', d), { recursive: true });
    writeFileSync(join(pasta, 'clipes', d, 'a.mp4'), Buffer.alloc(bytes));
    mkdirSync(join(pasta, 'eventos'), { recursive: true });
    writeFileSync(join(pasta, 'eventos', `${d}.jsonl`), '{}\n');
  }
  mkdirSync(join(pasta, 'guardados'), { recursive: true });
  writeFileSync(join(pasta, 'guardados', 'g.mp4'), Buffer.alloc(bytes));
}
const HOJE = new Date(2026, 10, 17, 12, 0, 0);

test('limparPorEspaco: clipesMaxGb excedido apaga os dias mais antigos até ficar abaixo; poupa hoje e guardados', () => {
  const pasta = pastaTemp();
  try {
    // 4 dias de 0,5 GB lógico cada (tamanho injetado), hoje incluído.
    const dias = ['2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17'];
    montarDias(pasta, dias);
    const logs = [];
    const r = limparPorEspaco({
      pasta, maxGb: 1, agora: HOJE, log: (m) => logs.push(m),
      tamanhoDia: () => 0.5 * GB,
    });
    // 2 GB > 1 GB: apaga 14 (1,5 GB), 15 (1,0 GB, não passa mais do limite) e para.
    assert.deepEqual(r.dias, ['2026-11-14', '2026-11-15']);
    assert.ok(Math.abs(r.gbLiberados - 1) < 1e-9);
    assert.ok(!existsSync(join(pasta, 'clipes', '2026-11-14')) && !existsSync(join(pasta, 'eventos', '2026-11-14.jsonl')));
    assert.ok(!existsSync(join(pasta, 'clipes', '2026-11-15')));
    for (const p of [join(pasta, 'clipes', '2026-11-16'), join(pasta, 'clipes', '2026-11-17'), join(pasta, 'guardados', 'g.mp4')]) assert.ok(existsSync(p), p);
    assert.equal(logs.length, 1);
    assert.match(logs[0], /2 dia/);
    assert.match(logs[0], /1\.00 GB/);
  } finally { rmSync(pasta, { recursive: true, force: true }); }
});

test('limparPorEspaco: com tamanho real, mede a pasta de clipes', () => {
  const pasta = pastaTemp();
  try {
    montarDias(pasta, ['2026-11-15', '2026-11-16'], 4000);
    // limite minúsculo (~5 KB): só cabe um dia; hoje (17) não existe aqui, então 15 sai e 16 também não pode ficar pior que o limite -> 15 sai.
    const r = limparPorEspaco({ pasta, maxGb: 5000 / GB, agora: HOJE });
    assert.deepEqual(r.dias, ['2026-11-15']);
    assert.ok(existsSync(join(pasta, 'clipes', '2026-11-16')));
  } finally { rmSync(pasta, { recursive: true, force: true }); }
});

test('limparPorEspaco: nunca apaga hoje, mesmo acima do limite', () => {
  const pasta = pastaTemp();
  try {
    montarDias(pasta, ['2026-11-16', '2026-11-17']);
    const r = limparPorEspaco({ pasta, maxGb: 0.1, agora: HOJE, tamanhoDia: () => GB });
    assert.deepEqual(r.dias, ['2026-11-16']);
    assert.ok(existsSync(join(pasta, 'clipes', '2026-11-17')));
  } finally { rmSync(pasta, { recursive: true, force: true }); }
});

test('limparPorEspaco: discoLivreMinGb com pouco espaço livre (falso) apaga dos mais antigos até chegar ao mínimo', () => {
  const pasta = pastaTemp();
  try {
    const dias = ['2026-11-13', '2026-11-14', '2026-11-15', '2026-11-17'];
    montarDias(pasta, dias);
    const livre = () => GB + dias.filter((d) => !existsSync(join(pasta, 'clipes', d))).length * GB;
    const logs = [];
    const r = limparPorEspaco({
      pasta, livreMinGb: 3, agora: HOJE, log: (m) => logs.push(m),
      tamanhoDia: () => GB,
      livreBytes: livre,
    });
    assert.deepEqual(r.dias, ['2026-11-13', '2026-11-14']);
    assert.ok(existsSync(join(pasta, 'clipes', '2026-11-15')) && existsSync(join(pasta, 'guardados', 'g.mp4')));
    assert.match(logs[0], /2 dia/);
    assert.match(logs[0], /disco livre/i);
  } finally { rmSync(pasta, { recursive: true, force: true }); }
});

test('limparPorEspaco: as duas chaves em 0 não fazem nada', () => {
  const pasta = pastaTemp();
  try {
    montarDias(pasta, ['2026-01-01', '2026-11-16']);
    const r = limparPorEspaco({ pasta, maxGb: 0, livreMinGb: 0, agora: HOJE, livreBytes: () => 0 });
    assert.deepEqual(r, { dias: [], gbLiberados: 0 });
    assert.ok(existsSync(join(pasta, 'clipes', '2026-01-01')));
  } finally { rmSync(pasta, { recursive: true, force: true }); }
});

test('limparPorEspaco: espaço livre indisponível não apaga nada e avisa', () => {
  const pasta = pastaTemp();
  try {
    montarDias(pasta, ['2026-11-01']);
    const logs = [];
    const r = limparPorEspaco({ pasta, livreMinGb: 5, agora: HOJE, livreBytes: () => { throw new Error('sem statfs'); }, log: (m) => logs.push(m) });
    assert.deepEqual(r.dias, []);
    assert.ok(existsSync(join(pasta, 'clipes', '2026-11-01')));
    assert.match(logs[0], /sem statfs/);
  } finally { rmSync(pasta, { recursive: true, force: true }); }
});

test('configDeteccao: clipesMaxGb e discoLivreMinGb padrão 0, recusam negativo e texto', async () => {
  const { configDeteccao } = await import('../src/deteccao/config.js');
  const c = configDeteccao({ resolucao: '1280x720' });
  assert.equal(c.clipesMaxGb, 0);
  assert.equal(c.discoLivreMinGb, 0);
  assert.throws(() => configDeteccao({ resolucao: '1280x720',  clipesMaxGb: -1 }), /clipesMaxGb/);
  assert.throws(() => configDeteccao({ resolucao: '1280x720',  discoLivreMinGb: 'muito' }), /discoLivreMinGb/);
  assert.equal(configDeteccao({ resolucao: '1280x720',  clipesMaxGb: 2.5 }).clipesMaxGb, 2.5);
});
