import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { cenario } from './servidor-util.js';

function preparar(c) {
  mkdirSync(join(c.pasta, 'trechos', '2026-11-17'), { recursive: true });
  mkdirSync(join(c.pasta, 'clipes', '2026-11-17'), { recursive: true });
  mkdirSync(join(c.pasta, 'aovivo'), { recursive: true });
  mkdirSync(join(c.pasta, 'eventos'), { recursive: true });
  writeFileSync(join(c.pasta, 'trechos', '2026-11-17', '14-02-00.mp4'), Buffer.alloc(1000, 7));
  writeFileSync(join(c.pasta, 'clipes', '2026-11-17', '14-02-55-movimento.jpg'), Buffer.alloc(50, 1));
  writeFileSync(join(c.pasta, 'aovivo', 'index.m3u8'), '#EXTM3U\n');
  writeFileSync(join(c.pasta, 'aovivo', 'seg00001.ts'), Buffer.alloc(20));
  writeFileSync(join(c.pasta, 'estado.json'), '{"estado":"gravando"}');
  writeFileSync(join(c.pasta, 'eventos', 'x.jsonl'), '{}');
  writeFileSync(join(c.pasta, 'trechos', 'segredo.txt'), 'nao');
  writeFileSync(join(c.pasta, '..', 'config.local.json'), '{"segredo":1}');
}

test('serve trechos, clipes e ao vivo com o tipo certo', async () => {
  const c = await cenario(); preparar(c);
  try {
    let r = await c.req('/arquivos/trechos/2026-11-17/14-02-00.mp4');
    assert.equal(r.status, 200);
    assert.equal(r.headers['content-type'], 'video/mp4');
    assert.equal(r.headers['accept-ranges'], 'bytes');
    assert.equal(r.buf.length, 1000);
    r = await c.req('/arquivos/clipes/2026-11-17/14-02-55-movimento.jpg');
    assert.equal(r.headers['content-type'], 'image/jpeg');
    r = await c.req('/aovivo/index.m3u8');
    assert.equal(r.headers['content-type'], 'application/vnd.apple.mpegurl');
    assert.equal(r.headers['cache-control'], 'no-store');
    assert.equal((await c.req('/aovivo/seg00001.ts')).headers['content-type'], 'video/mp2t');
    r = await c.req('/arquivos/trechos/2026-11-17/14-02-00.mp4', { metodo: 'HEAD' });
    assert.equal(r.status, 200);
    assert.equal(r.headers['content-length'], '1000');
  } finally { await c.fim(); }
});

test('tentativas de path traversal e arquivos fora da lista dão 404', async () => {
  const c = await cenario(); preparar(c);
  const casos = [
    '/arquivos/trechos/..%2f..%2fconfig.local.json',
    '/arquivos/trechos/%2e%2e%5cestado.json',
    '/arquivos/trechos/%2e%2e%2f%2e%2e%2festado.json',
    '/arquivos/trechos/2026-11-17/..%2f..%2f..%2fconfig.local.json',
    '/arquivos/trechos/../estado.json',
    '/arquivos/trechos/2026-11-17/../../estado.json',
    '/arquivos/trechos/2026-11-17/%2e%2e/%2e%2e/estado.json',
    '/arquivos/trechos/%5c..%5cestado.json',
    '/arquivos/trechos/2026-11-17/14-02-00.mp4%00.jpg',
    '/arquivos/trechos/2026-11-17/14-02-00.mp4%00',
    '/arquivos/trechos/C:\\Windows\\win.ini',
    '/arquivos/trechos/C%3A%5CWindows%5Cwin.ini',
    '/arquivos/trechos/C%3A/x.mp4',
    '/arquivos/trechos/%252e%252e/estado.json',
    '/arquivos/trechos/2026-11-17/14-02-00%252emp4',
    '/arquivos/TRECHOS/2026-11-17/14-02-00.mp4',
    '/arquivos/TRECHOS/../estado.json',
    '/arquivos/Trechos/2026-11-17/14-02-00.mp4',
    '/arquivos/estado.json',
    '/arquivos/eventos/x.jsonl',
    '/arquivos/trechos/segredo.txt',
    '/arquivos/trechos/2026-11-17/14-02-00.MP4',
    '/arquivos/trechos/2026-11-17/',
    '/arquivos/trechos//2026-11-17/14-02-00.mp4',
    '/arquivos//trechos/2026-11-17/14-02-00.mp4',
    '/arquivos/trechos/2026-11-17/nao-existe.mp4',
    '/arquivos/trechos/2026-11-17',
    '/aovivo/../estado.json',
    '/aovivo/..%2festado.json',
    '/aovivo/index.m3u8%00.txt',
    '/aovivo/estado.json',
    '/aovivo/%2e%2e%2fconfig.local.json',
    '/aovivo',
    '/estado.json',
    '/gravacoes/estado.json',
    '/arquivos/trechos/%',
    '/arquivos/trechos/2026-11-17/14-02-00.mp4::$DATA',
  ];
  try {
    for (const caminho of casos) {
      const r = await c.req(caminho);
      assert.equal(r.status, 404, `${caminho} deveria dar 404, deu ${r.status}`);
      assert.ok(!r.texto.includes('segredo'), caminho);
    }
  } finally { await c.fim(); }
});

test('link simbólico que sai da pasta dá 404', async (t) => {
  const c = await cenario(); preparar(c);
  try {
    try { symlinkSync(join(c.pasta, 'estado.json'), join(c.pasta, 'trechos', '2026-11-17', '15-00-00.mp4')); }
    catch (e) { t.skip(`sem permissão para criar link simbólico (${e.code})`); return; }
    assert.equal((await c.req('/arquivos/trechos/2026-11-17/15-00-00.mp4')).status, 404);
  } finally { await c.fim(); }
});

test('Range: 206 com Content-Range, sufixo, aberto e 416', async () => {
  const c = await cenario(); preparar(c);
  const url = '/arquivos/trechos/2026-11-17/14-02-00.mp4';
  try {
    let r = await c.req(url, { headers: { Range: 'bytes=0-99' } });
    assert.equal(r.status, 206);
    assert.equal(r.buf.length, 100);
    assert.equal(r.headers['content-range'], 'bytes 0-99/1000');
    r = await c.req(url, { headers: { Range: 'bytes=990-' } });
    assert.equal(r.status, 206);
    assert.equal(r.buf.length, 10);
    assert.equal(r.headers['content-range'], 'bytes 990-999/1000');
    r = await c.req(url, { headers: { Range: 'bytes=-50' } });
    assert.equal(r.headers['content-range'], 'bytes 950-999/1000');
    r = await c.req(url, { headers: { Range: 'bytes=900-5000' } });
    assert.equal(r.headers['content-range'], 'bytes 900-999/1000');
    r = await c.req(url, { headers: { Range: 'bytes=1000-' } });
    assert.equal(r.status, 416);
    assert.equal(r.headers['content-range'], 'bytes */1000');
    assert.equal((await c.req(url, { headers: { Range: 'bytes=5-2' } })).status, 416);
    assert.equal((await c.req(url, { headers: { Range: 'bytes=abc' } })).status, 416);
  } finally { await c.fim(); }
});
