import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { cenario } from './servidor-util.js';
import { limparTrechos } from '../src/limpeza.js';
import { limparClipes } from '../src/deteccao/registro.js';

const AGORA = new Date(2026, 10, 17, 16, 30, 0);
const DIA = '2026-11-17';

function mp4(tipo = 'vide', bytes = 2048) {
  const b = Buffer.alloc(bytes, 0x20);
  b.write('ftyp', 4, 'latin1');
  b.write('hdlr', 100, 'latin1');
  b.write(tipo, 112, 'latin1');
  return b;
}

/** Monta um dia com clipes, eventos e trechos. */
function montar(pasta) {
  const clipes = join(pasta, 'clipes', DIA);
  const trechos = join(pasta, 'trechos', DIA);
  mkdirSync(clipes, { recursive: true });
  mkdirSync(trechos, { recursive: true });
  mkdirSync(join(pasta, 'eventos'), { recursive: true });
  const ev = (id, hm, nome) => {
    writeFileSync(join(clipes, `${nome}.mp4`), mp4());
    writeFileSync(join(clipes, `${nome}.jpg`), Buffer.alloc(10));
    return JSON.stringify({
      id, inicio: `${DIA}T${hm}-03:00`, fim: `${DIA}T${hm}-03:00`, tipo: 'movimento', intensidade: 0.5,
      clipe: `clipes/${DIA}/${nome}.mp4`, miniatura: `clipes/${DIA}/${nome}.jpg`,
    });
  };
  const linhas = [
    ev(`${DIA}_15-10-00-movimento`, '15:10:05', '15-10-00-movimento'),
    ev(`${DIA}_16-05-00-movimento`, '16:05:05', '16-05-00-movimento'),
    ev(`${DIA}_16-20-00-movimento`, '16:20:05', '16-20-00-movimento'),
    'linha ruim',
  ];
  writeFileSync(join(pasta, 'eventos', `${DIA}.jsonl`), linhas.join('\n') + '\n');
  for (const n of ['15-59-00', '16-00-00', '16-01-00', '16-29-00']) writeFileSync(join(trechos, `${n}.mp4`), mp4());
  const velho = new Date(AGORA.getTime() - 3600_000);
  for (const n of ['15-59-00', '16-00-00', '16-01-00']) utimesSync(join(trechos, `${n}.mp4`), velho, velho);
  utimesSync(join(trechos, '16-29-00.mp4'), AGORA, AGORA); // em andamento
}

const postar = (c, caminho, corpo, headers = {}) => c.req(caminho, {
  metodo: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Rocky': '1', ...headers },
  corpo: typeof corpo === 'string' ? corpo : JSON.stringify(corpo),
});

const ids = (c) => readFileSync(join(c.pasta, 'eventos', `${DIA}.jsonl`), 'utf8');

test('apagar um evento: some o vídeo, a miniatura e a linha do jsonl', async () => {
  const c = await cenario({ agora: () => AGORA });
  try {
    montar(c.pasta);
    const r = await postar(c, '/api/apagar/evento', { dia: DIA, id: `${DIA}_16-05-00-movimento` });
    assert.equal(r.status, 200, r.texto);
    assert.equal(r.json.ok, true);
    assert.equal(r.json.eventos, 1);
    assert.equal(r.json.arquivos, 2);
    assert.equal(existsSync(join(c.pasta, 'clipes', DIA, '16-05-00-movimento.mp4')), false);
    assert.equal(existsSync(join(c.pasta, 'clipes', DIA, '16-05-00-movimento.jpg')), false);
    assert.doesNotMatch(ids(c), /16-05-00-movimento/);
    assert.match(ids(c), /16-20-00-movimento/);
    assert.match(ids(c), /linha ruim/, 'linhas que não entende ficam como estão');
    const dia = (await c.req(`/api/dia/${DIA}`)).json;
    assert.equal(dia.eventos.length, 2);
  } finally { await c.fim(); }
});

test('apagar evento: id inexistente dá 404 e não mexe em nada', async () => {
  const c = await cenario({ agora: () => AGORA });
  try {
    montar(c.pasta);
    const antes = ids(c);
    const r = await postar(c, '/api/apagar/evento', { dia: DIA, id: 'nao-existe' });
    assert.equal(r.status, 404);
    assert.equal(r.json.ok, false);
    assert.equal(ids(c), antes);
    assert.equal((await postar(c, '/api/apagar/evento', { dia: '2026-11-16', id: 'x' })).status, 404);
  } finally { await c.fim(); }
});

test('apagar evento: clipe que aponta para fora de clipes/ não é apagado', async () => {
  const c = await cenario({ agora: () => AGORA });
  try {
    montar(c.pasta);
    writeFileSync(join(c.pasta, 'segredo.mp4'), mp4());
    mkdirSync(join(c.pasta, 'guardados', 'x'), { recursive: true });
    writeFileSync(join(c.pasta, 'guardados', 'x', 'a.mp4'), mp4());
    const ruins = [
      { id: 'a', clipe: '../segredo.mp4' },
      { id: 'b', clipe: 'clipes/../segredo.mp4' },
      { id: 'c', clipe: `trechos/${DIA}/16-00-00.mp4` },
      { id: 'd', clipe: 'guardados/x/a.mp4' },
      { id: 'e', clipe: 'C:/Windows/win.ini' },
    ];
    writeFileSync(join(c.pasta, 'eventos', `${DIA}.jsonl`), ruins.map((o) =>
      JSON.stringify({ ...o, inicio: `${DIA}T16:00:00-03:00`, tipo: 'som', intensidade: 0.2 })).join('\n') + '\n');
    for (const o of ruins) {
      const r = await postar(c, '/api/apagar/evento', { dia: DIA, id: o.id });
      assert.equal(r.status, 200, o.id);
      assert.equal(r.json.arquivos, 0, o.id);
    }
    assert.equal(existsSync(join(c.pasta, 'segredo.mp4')), true);
    assert.equal(existsSync(join(c.pasta, 'trechos', DIA, '16-00-00.mp4')), true);
    assert.equal(existsSync(join(c.pasta, 'guardados', 'x', 'a.mp4')), true);
  } finally { await c.fim(); }
});

test('apagar: dia inválido e path traversal no dia são recusados', async () => {
  const c = await cenario({ agora: () => AGORA });
  try {
    montar(c.pasta);
    for (const dia of ['../eventos/2026-11-17', '..', '2026-11-17/../x', '2026-02-30', 7, null]) {
      const r = await postar(c, '/api/apagar/evento', { dia, id: 'x' });
      assert.equal(r.status, 400, String(dia));
      const h = await postar(c, '/api/apagar/hora', { dia, hora: 16 });
      assert.equal(h.status, 400, String(dia));
    }
    for (const hora of [-1, 24, 1.5, '16', null]) {
      assert.equal((await postar(c, '/api/apagar/hora', { dia: DIA, hora })).status, 400, String(hora));
    }
    assert.equal((await postar(c, '/api/apagar/evento', { dia: DIA, id: '' })).status, 400);
    assert.equal((await postar(c, '/api/apagar/evento', 'não é json')).status, 400);
  } finally { await c.fim(); }
});

test('apagar a hora: clipes e eventos daquela hora; trechos só quando pedido, nunca o em andamento', async () => {
  const c = await cenario({ agora: () => AGORA });
  try {
    montar(c.pasta);
    let r = await postar(c, '/api/apagar/hora', { dia: DIA, hora: 16 });
    assert.equal(r.status, 200, r.texto);
    assert.deepEqual({ eventos: r.json.eventos, trechos: r.json.trechos }, { eventos: 2, trechos: 0 });
    assert.doesNotMatch(ids(c), /16-(05|20)-00/);
    assert.match(ids(c), /15-10-00/);
    assert.equal(existsSync(join(c.pasta, 'clipes', DIA, '15-10-00-movimento.mp4')), true);
    assert.equal(existsSync(join(c.pasta, 'trechos', DIA, '16-00-00.mp4')), true);

    r = await postar(c, '/api/apagar/hora', { dia: DIA, hora: 16, trechos: true });
    assert.equal(r.status, 200);
    assert.equal(r.json.trechos, 2);
    assert.equal(r.json.emAndamento, 1);
    const sobra = readdirSync(join(c.pasta, 'trechos', DIA)).sort();
    assert.deepEqual(sobra, ['15-59-00.mp4', '16-29-00.mp4']);
  } finally { await c.fim(); }
});

test('apagar a hora vazia devolve zero', async () => {
  const c = await cenario({ agora: () => AGORA });
  try {
    const r = await postar(c, '/api/apagar/hora', { dia: DIA, hora: 3, trechos: true });
    assert.equal(r.status, 200);
    assert.deepEqual([r.json.eventos, r.json.arquivos, r.json.trechos], [0, 0, 0]);
  } finally { await c.fim(); }
});

test('rotas de escrita: CSRF, método e host não permitido', async () => {
  const c = await cenario({ agora: () => AGORA });
  try {
    montar(c.pasta);
    const corpo = { dia: DIA, id: `${DIA}_16-05-00-movimento` };
    for (const caminho of ['/api/apagar/evento', '/api/apagar/hora', '/api/guardar', '/api/guardados/apagar']) {
      assert.equal((await postar(c, caminho, corpo, { Host: 'evil.example' })).status, 421, caminho);
      assert.equal((await postar(c, caminho, corpo, { 'X-Rocky': '0' })).status, 403, caminho);
      assert.equal((await postar(c, caminho, corpo, { 'Content-Type': 'text/plain' })).status, 403, caminho);
      assert.equal((await postar(c, caminho, corpo, { 'Sec-Fetch-Site': 'cross-site' })).status, 403, caminho);
      assert.equal((await postar(c, caminho, corpo, { Origin: 'http://evil.example' })).status, 403, caminho);
      assert.equal((await c.req(caminho)).status, 405, caminho);
    }
    assert.equal(existsSync(join(c.pasta, 'clipes', DIA, '16-05-00-movimento.mp4')), true);
    assert.equal((await c.req('/api/guardados', { headers: { Host: 'evil.example' } })).status, 421);
    assert.equal((await c.req('/api/guardados', { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  } finally { await c.fim(); }
});

test('guardar um clipe e um bloco de trechos; listar; tocar pelo /arquivos/guardados', async () => {
  const c = await cenario({ agora: () => AGORA });
  try {
    montar(c.pasta);
    let r = await postar(c, '/api/guardar', { urls: [`/arquivos/clipes/${DIA}/16-05-00-movimento.mp4`], rotulo: '16:05 · Movimento' });
    assert.equal(r.status, 201, r.texto);
    const g1 = r.json.guardado;
    assert.equal(g1.rotulo, '16:05 · Movimento');
    assert.equal(g1.arquivos.length, 1);
    assert.ok(g1.miniatura, 'a miniatura do clipe vem junto');
    r = await postar(c, '/api/guardar', { urls: [`/arquivos/trechos/${DIA}/16-00-00.mp4`, `/arquivos/trechos/${DIA}/16-01-00.mp4`], rotulo: '16:00–16:02' });
    assert.equal(r.status, 201, r.texto);
    // Guardar de novo a mesma coisa cria outra pasta (nome único), não sobrescreve.
    r = await postar(c, '/api/guardar', { urls: [`/arquivos/clipes/${DIA}/16-05-00-movimento.mp4`] });
    assert.equal(r.status, 201);
    assert.notEqual(r.json.guardado.nome, g1.nome);

    const lista = (await c.req('/api/guardados')).json.guardados;
    assert.equal(lista.length, 3);
    const bloco = lista.find((g) => g.rotulo === '16:00–16:02');
    assert.equal(bloco.arquivos.length, 2);
    assert.deepEqual(bloco.origens, [`/arquivos/trechos/${DIA}/16-00-00.mp4`, `/arquivos/trechos/${DIA}/16-01-00.mp4`]);
    const v = await c.req(bloco.arquivos[0].url);
    assert.equal(v.status, 200);
    assert.equal(v.headers['content-type'], 'video/mp4');
    // O original continua no lugar.
    assert.equal(existsSync(join(c.pasta, 'clipes', DIA, '16-05-00-movimento.mp4')), true);
  } finally { await c.fim(); }
});

test('guardar recusa url fora de trechos/clipes, inexistente, repetida ou demais', async () => {
  const c = await cenario({ agora: () => AGORA, cfg: { guardarMaxArquivos: 2 } });
  try {
    montar(c.pasta);
    writeFileSync(join(c.pasta, 'segredo.mp4'), mp4());
    const ruins = [
      [], 'x', [7], ['/arquivos/../segredo.mp4'], ['/arquivos/%2e%2e/segredo.mp4'], ['/aovivo/index.m3u8'],
      [`/arquivos/trechos/${DIA}/99-00-00.mp4`], [`/arquivos/clipes/${DIA}/16-05-00-movimento.jpg`],
      ['/arquivos/guardados/x/a.mp4'], [`/arquivos/trechos/${DIA}/..%5C..%5Csegredo.mp4`],
      [`/arquivos/trechos/${DIA}/16-00-00.mp4`, `/arquivos/trechos/${DIA}/16-01-00.mp4`, `/arquivos/trechos/${DIA}/15-59-00.mp4`],
    ];
    for (const urls of ruins) {
      const r = await postar(c, '/api/guardar', { urls });
      assert.equal(r.status, 400, JSON.stringify(urls));
    }
    const r = await postar(c, '/api/guardar', { urls: [`/arquivos/trechos/${DIA}/16-00-00.mp4`], rotulo: 'x'.repeat(500) });
    assert.equal(r.status, 201);
    assert.ok(r.json.guardado.rotulo.length <= 80);
    assert.equal(readdirSync(join(c.pasta, 'guardados')).length, 1);
  } finally { await c.fim(); }
});

test('guardados copiados à mão aparecem; pasta e arquivos estranhos são ignorados', async () => {
  const c = await cenario({ agora: () => AGORA });
  try {
    const g = join(c.pasta, 'guardados', '2026-11-17-rocky');
    mkdirSync(g, { recursive: true });
    for (let m = 52; m < 66; m++) writeFileSync(join(g, `16-${String(m % 60).padStart(2, '0')}-00.mp4`), mp4());
    writeFileSync(join(g, 'leia.txt'), 'x');
    mkdirSync(join(c.pasta, 'guardados', '.tmp-x'), { recursive: true });
    mkdirSync(join(c.pasta, 'guardados', 'vazia'), { recursive: true });
    writeFileSync(join(c.pasta, 'guardados', 'solto.mp4'), mp4());
    const lista = (await c.req('/api/guardados')).json.guardados;
    const rocky = lista.find((x) => x.nome === '2026-11-17-rocky');
    assert.ok(rocky);
    assert.equal(rocky.rotulo, '2026-11-17-rocky');
    assert.equal(rocky.arquivos.length, 14);
    assert.equal(rocky.miniatura, null);
    assert.ok(!lista.some((x) => x.nome.startsWith('.')));
    assert.ok(!lista.some((x) => x.nome === 'vazia'), 'pasta sem vídeo não aparece');
    assert.equal((await c.req('/arquivos/guardados/2026-11-17-rocky/leia.txt')).status, 404);
    assert.equal((await c.req('/arquivos/guardados/2026-11-17-rocky/16-52-00.mp4')).status, 200);
    assert.equal((await c.req('/arquivos/guardados/../trechos/x.mp4')).status, 404);
  } finally { await c.fim(); }
});

test('apagar guardado: some a pasta; nome ruim dá 400; inexistente 404', async () => {
  const c = await cenario({ agora: () => AGORA });
  try {
    const g = join(c.pasta, 'guardados', '2026-11-17-rocky');
    mkdirSync(g, { recursive: true });
    writeFileSync(join(g, '16-52-00.mp4'), mp4());
    for (const nome of ['..', '../trechos', 'a/b', '.tmp-x', '', 5, 'C:']) {
      assert.equal((await postar(c, '/api/guardados/apagar', { nome })).status, 400, String(nome));
    }
    assert.equal((await postar(c, '/api/guardados/apagar', { nome: 'nao-tem' })).status, 404);
    const r = await postar(c, '/api/guardados/apagar', { nome: '2026-11-17-rocky' });
    assert.equal(r.status, 200, r.texto);
    assert.equal(existsSync(g), false);
    assert.equal(existsSync(join(c.pasta, 'guardados')), true);
  } finally { await c.fim(); }
});

test('a limpeza de 4 h e a retenção dos clipes nunca tocam nos guardados', () => {
  const pasta = join(process.env.TEMP ?? '/tmp', `rocky-guard-${process.pid}-${Date.now()}`);
  const g = join(pasta, 'guardados', '2020-01-01-velho');
  mkdirSync(g, { recursive: true });
  writeFileSync(join(g, '00-00-00.mp4'), 'x');
  writeFileSync(join(g, '2020-01-01.jsonl'), 'x');
  mkdirSync(join(pasta, 'guardados', '2020-01-01'), { recursive: true });
  writeFileSync(join(pasta, 'guardados', '2020-01-01', '00-00-00.mp4'), 'x');
  const agora = new Date(2026, 10, 17, 12);
  limparTrechos({ pasta, bufferHoras: 4, agora });
  limparClipes({ pasta, dias: 1, agora });
  assert.equal(existsSync(join(g, '00-00-00.mp4')), true);
  assert.equal(existsSync(join(g, '2020-01-01.jsonl')), true);
  assert.equal(existsSync(join(pasta, 'guardados', '2020-01-01', '00-00-00.mp4')), true);
});

test('guardar pula o trecho que ainda está sendo gravado', async () => {
  const c = await cenario({ agora: () => AGORA });
  try {
    montar(c.pasta);
    const so = await postar(c, '/api/guardar', { urls: [`/arquivos/trechos/${DIA}/16-29-00.mp4`] });
    assert.equal(so.status, 409);
    const r = await postar(c, '/api/guardar', { urls: [`/arquivos/trechos/${DIA}/16-01-00.mp4`, `/arquivos/trechos/${DIA}/16-29-00.mp4`] });
    assert.equal(r.status, 201);
    assert.equal(r.json.pulados, 1);
    assert.equal(r.json.guardado.arquivos.length, 1);
  } finally { await c.fim(); }
});

test('guardadosPasta configurável: serve e lista da pasta escolhida', async () => {
  const c = await cenario({ agora: () => AGORA, cfg: { guardadosPasta: 'meus' } });
  try {
    montar(c.pasta);
    const r = await postar(c, '/api/guardar', { urls: [`/arquivos/trechos/${DIA}/16-00-00.mp4`] });
    assert.equal(r.status, 201);
    assert.equal(existsSync(join(c.pasta, 'meus', r.json.guardado.nome)), true);
    assert.equal((await c.req(r.json.guardado.arquivos[0].url)).status, 200);
  } finally { await c.fim(); }
});
