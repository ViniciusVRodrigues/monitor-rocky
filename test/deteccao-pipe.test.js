import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { spawnSync } from 'node:child_process';
import { abrirPipeQuadros } from '../src/deteccao/pipe.js';

const conectar = (caminho) => new Promise((r, j) => { const s = net.connect(caminho, () => r(s)); s.on('error', j); });
const fim = (s) => new Promise((r) => s.end(r));
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

test('recebe dados e chama aoConexao em cada conexão nova', async () => {
  const recebidos = [];
  let conexoes = 0;
  const p = await abrirPipeQuadros({ nome: 'rocky-teste-pipe', aoConexao: () => conexoes++, aoDados: (b) => recebidos.push(b) });
  try {
    const a = await conectar(p.caminho);
    a.write(Buffer.from([1, 2, 3]));
    await fim(a);
    const b = await conectar(p.caminho);
    b.write(Buffer.from([4]));
    await fim(b);
    await esperar(100);
    assert.equal(conexoes, 2);
    assert.deepEqual([...Buffer.concat(recebidos)], [1, 2, 3, 4]);
  } finally { await p.fechar(); }
});

test('handler que lança erro não derruba nem para a leitura', async () => {
  let n = 0;
  const logs = [];
  const p = await abrirPipeQuadros({ nome: 'rocky-teste-pipe-erro', aoDados: () => { n++; throw new Error('quebrou'); }, log: (m) => logs.push(m) });
  try {
    const a = await conectar(p.caminho);
    a.write(Buffer.alloc(10));
    await esperar(50);
    a.write(Buffer.alloc(10));
    await fim(a);
    await esperar(100);
    assert.equal(n, 2);
    assert.ok(logs.some((l) => /quebrou/.test(l)));
  } finally { await p.fechar(); }
});

const temFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;

test('o ffmpeg escreve quadros rawvideo no pipe', { skip: !temFfmpeg && 'ffmpeg fora do PATH' }, async () => {
  let total = 0;
  const p = await abrirPipeQuadros({ nome: 'rocky-teste-pipe-ff', aoDados: (b) => { total += b.length; } });
  try {
    const { spawn } = await import('node:child_process');
    const f = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=320x180:rate=10',
      '-t', '1', '-vf', 'fps=5,scale=160:90,format=gray', '-f', 'rawvideo', p.destinoFfmpeg], { windowsHide: true });
    const codigo = await new Promise((r) => f.on('exit', r));
    await esperar(200);
    assert.equal(codigo, 0);
    assert.equal(total % (160 * 90), 0);
    assert.ok(total / (160 * 90) >= 4);
  } finally { await p.fechar(); }
});
