import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { criarLogRotativo } from '../src/log-rotativo.js';

test('rotaciona ao passar do tamanho, mantém só N antigos', async () => {
  const pasta = mkdtempSync(join(tmpdir(), 'rocky-log-'));
  try {
    const log = criarLogRotativo({ pasta: join(pasta, 'sub'), maxBytes: 50, arquivos: 2, nome: 'm.log' });
    for (let i = 0; i < 12; i++) { log.escrever(`linha numero ${i} com texto`); await log.aguardar(); }
    const nomes = readdirSync(join(pasta, 'sub')).sort();
    assert.deepEqual(nomes, ['m.log', 'm.log.1', 'm.log.2']);
    assert.match(readFileSync(join(pasta, 'sub', 'm.log'), 'utf8'), /linha numero 11/);
    assert.match(readFileSync(join(pasta, 'sub', 'm.log.1'), 'utf8'), /linha numero (10|9)/);
  } finally { rmSync(pasta, { recursive: true, force: true }); }
});

test('assíncrono: escrever não bloqueia; aguardar() grava tudo; fila acima do limite descarta e conta', async () => {
  const pasta = mkdtempSync(join(tmpdir(), 'rocky-log-'));
  try {
    const log = criarLogRotativo({ pasta, nome: 'a.log', maxBytes: 1e6, arquivos: 2, filaMaxBytes: 100 });
    log.escrever('primeira');
    assert.equal(existsSync(join(pasta, 'a.log')), false, 'não escreve de forma síncrona');
    for (let i = 0; i < 20; i++) log.escrever(`linha de enchimento ${i}`); // passa de 100 bytes
    await log.aguardar();
    log.escrever('depois');
    await log.aguardar();
    const t = readFileSync(join(pasta, 'a.log'), 'utf8');
    assert.match(t, /primeira/);
    assert.match(t, /depois/);
    assert.match(t, /\d+ KB de log descartados/);
    assert.ok(!/linha de enchimento 19/.test(t));
  } finally { rmSync(pasta, { recursive: true, force: true }); }
});

test('assíncrono: rotaciona por tamanho', async () => {
  const pasta = mkdtempSync(join(tmpdir(), 'rocky-log-'));
  try {
    const log = criarLogRotativo({ pasta, nome: 'm.log', maxBytes: 50, arquivos: 2 });
    for (let i = 0; i < 12; i++) { log.escrever(`linha numero ${i} com texto`); await log.aguardar(); }
    assert.deepEqual(readdirSync(pasta).sort(), ['m.log', 'm.log.1', 'm.log.2']);
    assert.match(readFileSync(join(pasta, 'm.log'), 'utf8'), /linha numero 11/);
  } finally { rmSync(pasta, { recursive: true, force: true }); }
});
