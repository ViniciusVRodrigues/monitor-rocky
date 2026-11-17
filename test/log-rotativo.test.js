import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { criarLogRotativo } from '../src/log-rotativo.js';

test('rotaciona ao passar do tamanho, mantém só N antigos', () => {
  const pasta = mkdtempSync(join(tmpdir(), 'rocky-log-'));
  try {
    const log = criarLogRotativo({ pasta: join(pasta, 'sub'), maxBytes: 50, arquivos: 2, nome: 'm.log' });
    for (let i = 0; i < 12; i++) log.escrever(`linha numero ${i} com texto`);
    const nomes = readdirSync(join(pasta, 'sub')).sort();
    assert.deepEqual(nomes, ['m.log', 'm.log.1', 'm.log.2']);
    assert.match(readFileSync(join(pasta, 'sub', 'm.log'), 'utf8'), /linha numero 11/);
    assert.match(readFileSync(join(pasta, 'sub', 'm.log.1'), 'utf8'), /linha numero (10|9)/);
  } finally { rmSync(pasta, { recursive: true, force: true }); }
});
