import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { criarArmazem } from '../src/avisos/armazem.js';

const tmp = () => mkdtempSync(join(tmpdir(), 'rocky-avs-'));
const sub = (n) => ({ endpoint: `https://fcm.googleapis.com/fcm/send/${n}`, keys: { p256dh: 'p', auth: 'a' } });

test('gera chaves na primeira vez, grava e relê sem gerar de novo', () => {
  const base = tmp(); const dir = join(base, 'avisos');
  try {
    let n = 0;
    const gerar = () => { n++; return { publicKey: 'PUB', privateKey: 'PRIV' }; };
    const a = criarArmazem({ dir });
    assert.deepEqual(a.lerOuGerarChaves(gerar), { publica: 'PUB', privada: 'PRIV' });
    assert.equal(n, 1);
    assert.deepEqual(JSON.parse(readFileSync(join(dir, 'vapid.json'), 'utf8')), { publica: 'PUB', privada: 'PRIV' });
    assert.deepEqual(criarArmazem({ dir }).lerOuGerarChaves(gerar), { publica: 'PUB', privada: 'PRIV' });
    assert.equal(n, 1);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('vapid.json inválido é regerado', () => {
  const base = tmp();
  try {
    const a = criarArmazem({ dir: base });
    writeFileSync(join(base, 'vapid.json'), '{lixo');
    assert.equal(a.lerOuGerarChaves(() => ({ publicKey: 'X', privateKey: 'Y' })).publica, 'X');
    writeFileSync(join(base, 'vapid.json'), JSON.stringify({ publica: 1 }));
    assert.equal(criarArmazem({ dir: base }).lerOuGerarChaves(() => ({ publicKey: 'Z', privateKey: 'W' })).publica, 'Z');
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('inscrever é upsert por endpoint, persiste e cancela (idempotente)', () => {
  const base = tmp(); const dir = join(base, 'novo', 'avisos');
  try {
    const a = criarArmazem({ dir, agora: () => new Date(2026, 10, 18, 10, 0, 0) });
    a.inscrever(sub(1)); a.inscrever(sub(1)); a.inscrever(sub(2));
    assert.equal(a.listar().length, 2);
    assert.match(a.listar()[0].criada, /^2026-11-18T10:00:00[+-]\d\d:\d\d$/);
    assert.equal(a.tem(sub(1).endpoint), true);
    assert.equal(criarArmazem({ dir }).listar().length, 2, 'persistido');
    assert.equal(a.cancelar(sub(1).endpoint), true);
    assert.equal(a.cancelar(sub(1).endpoint), false);
    assert.equal(a.tem(sub(1).endpoint), false);
    assert.equal(criarArmazem({ dir }).listar().length, 1);
    assert.deepEqual(readdirSync(dir).filter((f) => f.endsWith('.tmp')), []);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('passou do máximo: sai a mais antiga por criada', () => {
  const base = tmp();
  try {
    let t = 0;
    const a = criarArmazem({ dir: base, maxInscricoes: 2, agora: () => new Date(2026, 10, 18, 10, 0, t++) });
    a.inscrever(sub(1)); a.inscrever(sub(2)); a.inscrever(sub(3));
    assert.deepEqual(a.listar().map((s) => s.endpoint), [sub(2).endpoint, sub(3).endpoint]);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('inscricoes.json corrompido começa vazio e loga', () => {
  const base = tmp();
  try {
    writeFileSync(join(base, 'inscricoes.json'), 'nao-json');
    const logs = [];
    const a = criarArmazem({ dir: base, log: (m) => logs.push(m) });
    assert.deepEqual(a.listar(), []);
    assert.equal(logs.length, 1);
    a.inscrever(sub(1));
    assert.equal(criarArmazem({ dir: base }).listar().length, 1);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('listar devolve cópia: mexer nela não altera o armazém', () => {
  const base = tmp();
  try {
    const a = criarArmazem({ dir: base });
    a.inscrever(sub(1));
    a.listar().length = 0; a.listar()[0].endpoint = 'x';
    assert.equal(a.tem(sub(1).endpoint), true);
    assert.equal(existsSync(join(base, 'inscricoes.json')), true);
  } finally { rmSync(base, { recursive: true, force: true }); }
});
