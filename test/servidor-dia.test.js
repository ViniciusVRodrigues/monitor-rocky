import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { cenario } from './servidor-util.js';
import { diaValido } from '../src/servidor/linha-tempo.js';

/** MP4 sintético: só os bytes que o servidor procura (hdlr + tipo). */
function mp4(tipo, bytes = 2048) {
  const b = Buffer.alloc(bytes, 0x20);
  b.write('ftyp', 4, 'latin1');
  b.write('hdlr', 100, 'latin1'); // 'hdlr' + versão(4) + pré-definido(4) + tipo
  b.write(tipo, 112, 'latin1');
  return b;
}
const AGORA = new Date(2026, 10, 17, 14, 3, 30);

test('diaValido confere formato e data real', () => {
  assert.equal(diaValido('2026-11-17'), true);
  assert.equal(diaValido('2026-13-40'), false);
  assert.equal(diaValido('2026-02-30'), false);
  assert.equal(diaValido('..'), false);
  assert.equal(diaValido('2026-1-1'), false);
});

test('/api/dias lista pastas e eventos em ordem decrescente e sempre traz hoje', async () => {
  const c = await cenario({ agora: () => AGORA });
  try {
    let r = (await c.req('/api/dias')).json;
    assert.deepEqual(r, { dias: ['2026-11-17'], hoje: '2026-11-17' });
    mkdirSync(join(c.pasta, 'trechos', '2026-11-15'), { recursive: true });
    mkdirSync(join(c.pasta, 'clipes', '2026-11-16'), { recursive: true });
    mkdirSync(join(c.pasta, 'trechos', 'lixo'), { recursive: true });
    mkdirSync(join(c.pasta, 'trechos', '2026-11-18'), { recursive: true }); // véspera vazia: fora
    mkdirSync(join(c.pasta, 'eventos'), { recursive: true });
    writeFileSync(join(c.pasta, 'eventos', '2026-11-14.jsonl'), '');
    writeFileSync(join(c.pasta, 'eventos', 'x.jsonl'), '');
    r = (await c.req('/api/dias')).json;
    assert.deepEqual(r.dias, ['2026-11-17', '2026-11-16', '2026-11-15', '2026-11-14']);
    assert.equal(r.hoje, '2026-11-17');
  } finally { await c.fim(); }
});

test('/api/dia: trechos com soAudio, emAndamento, filtros; eventos tolerando linhas ruins', async () => {
  const c = await cenario({ agora: () => AGORA });
  try {
    const dir = join(c.pasta, 'trechos', '2026-11-17');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '14-00-00.mp4'), mp4('vide'));
    writeFileSync(join(dir, '14-01-00.mp4'), mp4('soun'));
    writeFileSync(join(dir, '14-02-00.mp4'), mp4('vide', 5000));
    writeFileSync(join(dir, '14-02-30.mp4'), Buffer.alloc(100)); // pequeno demais
    writeFileSync(join(dir, 'lixo.mp4'), mp4('vide'));
    writeFileSync(join(dir, '25-00-00.mp4'), mp4('vide'));
    const velho = new Date(AGORA.getTime() - 3600_000);
    for (const n of ['14-00-00.mp4', '14-01-00.mp4']) utimesSync(join(dir, n), velho, velho);
    utimesSync(join(dir, '14-02-00.mp4'), new Date(AGORA.getTime() - 20_000), new Date(AGORA.getTime() - 20_000));
    mkdirSync(join(c.pasta, 'clipes', '2026-11-17'), { recursive: true });
    writeFileSync(join(c.pasta, 'clipes', '2026-11-17', '14-02-55-movimento.mp4'), mp4('vide'));
    writeFileSync(join(c.pasta, 'clipes', '2026-11-17', '14-02-55-movimento.jpg'), Buffer.alloc(10));
    mkdirSync(join(c.pasta, 'eventos'), { recursive: true });
    const ev = (o) => JSON.stringify(o);
    writeFileSync(join(c.pasta, 'eventos', '2026-11-17.jsonl'), [
      ev({ id: 'b', inicio: '2026-11-17T14:03:05-03:00', fim: '2026-11-17T14:03:12-03:00', tipo: 'movimento', intensidade: 1.7,
        clipe: '/arquivos/clipes/2026-11-17/14-02-55-movimento.mp4', miniatura: 'clipes/2026-11-17/14-02-55-movimento.jpg' }),
      '{linha quebrada',
      ev({ id: 'a', inicio: '2026-11-17T13:00:00-03:00', tipo: 'som', intensidade: 0.4, clipe: '/arquivos/clipes/2026-11-17/../../estado.json', miniatura: '/arquivos/clipes/2026-11-17/nao-existe.jpg' }),
      ev({ id: 'c', inicio: '2026-11-17T15:00:00-03:00', tipo: 'outro', intensidade: 0.4 }),
      ev({ id: 'd', inicio: '2026-11-17T15:00:00-03:00', tipo: 'som', intensidade: 'alto' }),
      '"texto"', '', 'null',
    ].join('\n'));

    const r = await c.req('/api/dia/2026-11-17');
    assert.equal(r.status, 200);
    assert.equal(r.json.dia, '2026-11-17');
    assert.equal(r.json.hoje, true);
    assert.deepEqual(r.json.trechos.map((t) => [t.inicio, t.soAudio, t.emAndamento]), [
      ['14:00:00', false, false], ['14:01:00', true, false], ['14:02:00', false, true],
    ]);
    assert.equal(r.json.trechos[0].url, '/arquivos/trechos/2026-11-17/14-00-00.mp4');
    assert.equal(r.json.trechos[2].bytes, 5000);
    assert.deepEqual(r.json.eventos.map((e) => e.id), ['a', 'b']);
    const [a, b] = r.json.eventos;
    assert.equal(b.intensidade, 1);
    assert.equal(b.clipe, '/arquivos/clipes/2026-11-17/14-02-55-movimento.mp4');
    assert.equal(b.miniatura, '/arquivos/clipes/2026-11-17/14-02-55-movimento.jpg');
    assert.equal(a.clipe, null);
    assert.equal(a.miniatura, null);
    assert.equal(a.fim, a.inicio);
    // os URLs devolvidos de fato abrem
    assert.equal((await c.req(b.clipe)).status, 200);
  } finally { await c.fim(); }
});

test('/api/dia: dia de outro dia nunca fica emAndamento; dia sem nada vem vazio; dia inválido dá 400', async () => {
  const c = await cenario({ agora: () => AGORA });
  try {
    const dir = join(c.pasta, 'trechos', '2026-11-16');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '23-59-00.mp4'), mp4('vide'));
    let r = (await c.req('/api/dia/2026-11-16')).json;
    assert.equal(r.hoje, false);
    assert.equal(r.trechos[0].emAndamento, false);
    r = (await c.req('/api/dia/2026-11-10')).json;
    assert.deepEqual([r.trechos, r.eventos], [[], []]);
    for (const ruim of ['2026-13-40', '..', '%2e%2e', '2026-11-17/x', '2026-1-1', '']) {
      assert.equal((await c.req(`/api/dia/${ruim}`)).status, 400, ruim);
    }
  } finally { await c.fim(); }
});
