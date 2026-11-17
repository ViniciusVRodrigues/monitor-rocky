import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { limparTrechos, garantirPastas } from '../src/limpeza.js';

const p2 = (n) => String(n).padStart(2, '0');
function criar(pasta, d) {
  const dia = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  const hora = `${p2(d.getHours())}-${p2(d.getMinutes())}-${p2(d.getSeconds())}.mp4`;
  mkdirSync(join(pasta, 'trechos', dia), { recursive: true });
  const f = join(pasta, 'trechos', dia, hora);
  writeFileSync(f, 'x');
  return f;
}
const temp = () => mkdtempSync(join(tmpdir(), 'rocky-lim-'));

test('apaga trecho de 5 h e mantém os de menos de 4 h; remove dia vazio', () => {
  const pasta = temp();
  try {
    const agora = new Date(2026, 10, 17, 12, 0, 0);
    const velho = criar(pasta, new Date(2026, 10, 16, 7, 0, 0));
    const velhoHoje = criar(pasta, new Date(2026, 10, 17, 7, 0, 0));
    const novo = criar(pasta, new Date(2026, 10, 17, 8, 30, 0));
    const r = limparTrechos({ pasta, bufferHoras: 4, agora });
    assert.equal(existsSync(velho), false);
    assert.equal(existsSync(velhoHoje), false);
    assert.equal(existsSync(novo), true);
    assert.equal(existsSync(join(pasta, 'trechos', '2026-11-16')), false);
    assert.equal(r.apagados, 2);
  } finally { rmSync(pasta, { recursive: true, force: true }); }
});

test('nunca apaga fora de trechos/ nem arquivos que não seguem o padrão', () => {
  const pasta = temp();
  try {
    mkdirSync(join(pasta, 'aovivo'), { recursive: true });
    mkdirSync(join(pasta, 'clipes'), { recursive: true });
    writeFileSync(join(pasta, 'aovivo', 'seg0.ts'), 'x');
    writeFileSync(join(pasta, 'clipes', '2020-01-01.mp4'), 'x');
    mkdirSync(join(pasta, 'trechos', 'outra'), { recursive: true });
    writeFileSync(join(pasta, 'trechos', 'outra', 'a.txt'), 'x');
    mkdirSync(join(pasta, 'trechos', '2020-01-01'), { recursive: true });
    writeFileSync(join(pasta, 'trechos', '2020-01-01', 'nota.txt'), 'x');
    limparTrechos({ pasta, bufferHoras: 4, agora: new Date(2026, 10, 17, 12) });
    assert.ok(existsSync(join(pasta, 'aovivo', 'seg0.ts')));
    assert.ok(existsSync(join(pasta, 'clipes', '2020-01-01.mp4')));
    assert.ok(existsSync(join(pasta, 'trechos', 'outra', 'a.txt')));
    assert.ok(existsSync(join(pasta, 'trechos', '2020-01-01', 'nota.txt')));
  } finally { rmSync(pasta, { recursive: true, force: true }); }
});

test('sem pasta trechos não falha', () => {
  const pasta = temp();
  try {
    assert.equal(limparTrechos({ pasta, bufferHoras: 4 }).apagados, 0);
  } finally { rmSync(pasta, { recursive: true, force: true }); }
});

test('garantirPastas cria hoje, amanhã e aovivo', () => {
  const pasta = temp();
  try {
    garantirPastas(pasta, new Date(2026, 10, 30, 23, 59, 0));
    assert.ok(existsSync(join(pasta, 'trechos', '2026-11-30')));
    assert.ok(existsSync(join(pasta, 'trechos', '2026-12-01')));
    assert.ok(existsSync(join(pasta, 'aovivo')));
  } finally { rmSync(pasta, { recursive: true, force: true }); }
});
