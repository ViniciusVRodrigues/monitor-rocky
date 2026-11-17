import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acharTrechos, recortarClipe } from '../src/deteccao/clipes.js';

const temFfmpeg = spawnSync('ffmpeg', ['-version'], { windowsHide: true }).status === 0 &&
  spawnSync('ffprobe', ['-version'], { windowsHide: true }).status === 0;
if (!temFfmpeg) console.warn('AVISO: ffmpeg/ffprobe fora do PATH; testes de clipes pulados.');
const opts = { skip: !temFfmpeg && 'ffmpeg ausente' };

const CFG = { ffmpeg: 'ffmpeg', clipePreset: 'ultrafast', clipeCrf: 30, miniaturaLargura: 160 };
const T0 = new Date(2026, 2, 10, 10, 0, 0).getTime(); // 10:00:00 local
let raiz; // pasta de gravações de teste
let comEspaco;

function gerar(arquivo, { video = true, dur = 6 } = {}) {
  mkdirSync(join(arquivo, '..'), { recursive: true });
  const args = ['-hide_banner', '-loglevel', 'error', '-y'];
  if (video) args.push('-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=15');
  args.push('-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100', '-t', String(dur));
  if (video) {
    args.push('-c:v', 'libx264', '-g', '30', '-pix_fmt', 'yuv420p');
  }
  args.push('-c:a', 'aac', '-movflags', '+frag_keyframe+empty_moov+default_base_moof', '-f', 'mp4', arquivo);
  const r = spawnSync('ffmpeg', args, { windowsHide: true });
  assert.equal(r.status, 0, String(r.stderr));
}

function sondar(arquivo) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type',
    '-of', 'json', arquivo], { windowsHide: true, encoding: 'utf8' });
  const j = JSON.parse(r.stdout);
  return { dur: Number(j.format.duration), tipos: j.streams.map((s) => s.codec_type) };
}

function largura(jpg) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width', '-of', 'csv=p=0', jpg],
    { windowsHide: true, encoding: 'utf8' });
  return Number(r.stdout.trim());
}

// ffmpeg é lento de abrir nesta máquina: gera 1 trecho de cada tipo e copia.
let fonteV;
let fonteA;
function copiar(arquivo, { video = true } = {}) {
  mkdirSync(join(arquivo, '..'), { recursive: true });
  copyFileSync(video ? fonteV : fonteA, arquivo);
}

const tmps = (dir) => readdirSync(dir).filter((n) => n.includes('.tmp'));

before(() => {
  if (!temFfmpeg) return;
  raiz = mkdtempSync(join(tmpdir(), 'rocky-clipes-'));
  fonteV = join(raiz, 'fonte', 'v.mp4');
  fonteA = join(raiz, 'fonte', 'a.mp4');
  gerar(fonteV);
  gerar(fonteA, { video: false });
  const d = join(raiz, 'trechos', '2026-03-10');
  copiar(join(d, '10-00-00.mp4'));
  copiar(join(d, '10-00-06.mp4'));
  copiar(join(d, '10-00-12.mp4'));
  writeFileSync(join(d, 'lixo.txt'), 'x');
  writeFileSync(join(d, '10-00-30.mp4.part'), 'x');
  writeFileSync(join(d, '10-00-24.mp4'), 'não é mp4'); // ilegível: ignorado
  comEspaco = mkdtempSync(join(tmpdir(), 'rocky clipes espaco-'));
  copiar(join(comEspaco, 'trechos', '2026-03-10', '10-00-00.mp4'));
});

after(() => {
  if (raiz) rmSync(raiz, { recursive: true, force: true });
  if (comEspaco) rmSync(comEspaco, { recursive: true, force: true });
});

test('acharTrechos: só os que cruzam a janela, ignora fora do padrão e ilegíveis', opts, async () => {
  const todos = await acharTrechos({ pasta: raiz, inicioMs: T0, fimMs: T0 + 20000 });
  assert.deepEqual(todos.map((t) => t.inicioMs - T0), [0, 6000, 12000]);
  assert.ok(todos.every((t) => t.temVideo && Math.abs(t.duracaoS - 6) < 0.5));
  const meio = await acharTrechos({ pasta: raiz, inicioMs: T0 + 7000, fimMs: T0 + 9000 });
  assert.deepEqual(meio.map((t) => t.inicioMs - T0), [6000]);
  const longe = await acharTrechos({ pasta: raiz, inicioMs: T0 + 3600000, fimMs: T0 + 3601000 });
  assert.deepEqual(longe, []);
});

test('janela dentro de um trecho', opts, async () => {
  const trechos = await acharTrechos({ pasta: raiz, inicioMs: T0 + 7000, fimMs: T0 + 10000 });
  const destino = join(raiz, 'clipes', 'a');
  mkdirSync(join(raiz, 'clipes'), { recursive: true });
  const r = await recortarClipe({
    trechos, inicioMs: T0 + 7000, fimMs: T0 + 10000, destino, instanteMiniaturaMs: T0 + 8000, cfg: CFG,
  });
  assert.equal(r.soAudio, false);
  assert.equal(r.clipe, `${destino}.mp4`);
  const s = sondar(r.clipe);
  assert.ok(Math.abs(s.dur - 3) <= 0.5, `duração ${s.dur}`);
  assert.ok(s.tipos.includes('video') && s.tipos.includes('audio'));
  assert.ok(existsSync(r.miniatura));
  assert.equal(largura(r.miniatura), 160);
  assert.deepEqual(tmps(join(raiz, 'clipes')), []);
});

test('janela atravessando a borda de 2 trechos', opts, async () => {
  const ini = T0 + 4000;
  const fim = T0 + 9000;
  const trechos = await acharTrechos({ pasta: raiz, inicioMs: ini, fimMs: fim });
  assert.equal(trechos.length, 2);
  const destino = join(raiz, 'clipes', 'b');
  const r = await recortarClipe({ trechos, inicioMs: ini, fimMs: fim, destino, instanteMiniaturaMs: fim + 99999, cfg: CFG });
  const s = sondar(r.clipe);
  assert.ok(Math.abs(s.dur - 5) <= 1, `duração ${s.dur}`);
  assert.ok(s.tipos.includes('video') && s.tipos.includes('audio'));
  assert.ok(existsSync(r.miniatura), 'instante fora da janela usa o meio');
});

test('janela que cobre 3 trechos', opts, async () => {
  const ini = T0 + 2000;
  const fim = T0 + 16000;
  const trechos = await acharTrechos({ pasta: raiz, inicioMs: ini, fimMs: fim });
  assert.equal(trechos.length, 3);
  const r = await recortarClipe({ trechos, inicioMs: ini, fimMs: fim, destino: join(raiz, 'clipes', 'c'), instanteMiniaturaMs: ini, cfg: CFG });
  const s = sondar(r.clipe);
  assert.ok(Math.abs(s.dur - 14) <= 1, `duração ${s.dur}`);
  assert.deepEqual(tmps(join(raiz, 'clipes')), []);
});

test('trechos só de áudio: clipe sem vídeo e sem miniatura', opts, async () => {
  const d = join(raiz, 'trechos', '2026-03-10');
  copiar(join(d, '10-10-00.mp4'), { video: false });
  copiar(join(d, '10-10-06.mp4'), { video: false });
  const ini = T0 + 600000 + 2000;
  const fim = T0 + 600000 + 10000;
  const trechos = await acharTrechos({ pasta: raiz, inicioMs: ini, fimMs: fim });
  assert.equal(trechos.length, 2);
  assert.ok(trechos.every((t) => !t.temVideo));
  const destino = join(raiz, 'clipes', 'd');
  const r = await recortarClipe({ trechos, inicioMs: ini, fimMs: fim, destino, instanteMiniaturaMs: ini, cfg: CFG });
  assert.equal(r.soAudio, true);
  assert.equal(r.miniatura, null);
  assert.ok(!existsSync(`${destino}.jpg`));
  const s = sondar(r.clipe);
  assert.deepEqual(s.tipos, ['audio']);
  assert.ok(Math.abs(s.dur - 8) <= 1, `duração ${s.dur}`);
});

test('mistura vídeo + só áudio vira clipe só de áudio', opts, async () => {
  const d = join(raiz, 'trechos', '2026-03-10');
  copiar(join(d, '10-20-00.mp4'), { video: true });
  copiar(join(d, '10-20-06.mp4'), { video: false });
  const ini = T0 + 1200000 + 3000;
  const fim = T0 + 1200000 + 9000;
  const trechos = await acharTrechos({ pasta: raiz, inicioMs: ini, fimMs: fim });
  assert.equal(trechos.length, 2);
  const r = await recortarClipe({ trechos, inicioMs: ini, fimMs: fim, destino: join(raiz, 'clipes', 'e'), instanteMiniaturaMs: ini, cfg: CFG });
  assert.equal(r.soAudio, true);
  assert.equal(r.miniatura, null);
  assert.deepEqual(sondar(r.clipe).tipos, ['audio']);
});

test('sem trechos: tudo nulo', opts, async () => {
  const r = await recortarClipe({ trechos: [], inicioMs: T0, fimMs: T0 + 1000, destino: join(raiz, 'x'), instanteMiniaturaMs: T0, cfg: CFG });
  assert.deepEqual(r, { clipe: null, miniatura: null, soAudio: false });
});

test('caminho com espaço (pasta e apóstrofo)', opts, async () => {
  const ini = T0 + 1000;
  const fim = T0 + 4000;
  const trechos = await acharTrechos({ pasta: comEspaco, inicioMs: ini, fimMs: fim });
  assert.equal(trechos.length, 1);
  const destDir = join(comEspaco, "clipes de 'teste'");
  mkdirSync(destDir, { recursive: true });
  const r = await recortarClipe({ trechos, inicioMs: ini, fimMs: fim, destino: join(destDir, 'c d'), instanteMiniaturaMs: ini + 1000, cfg: CFG });
  assert.ok(existsSync(r.clipe) && existsSync(r.miniatura));
});

test('falha do ffmpeg: erro em pt-BR, sem .tmp sobrando', opts, async () => {
  const dir = join(raiz, 'falha');
  mkdirSync(dir, { recursive: true });
  const ruim = [{ arquivo: join(dir, 'nao-existe.mp4'), inicioMs: T0, duracaoS: 5, temVideo: true }];
  await assert.rejects(
    recortarClipe({ trechos: ruim, inicioMs: T0, fimMs: T0 + 3000, destino: join(dir, 'z'), instanteMiniaturaMs: T0, cfg: CFG }),
    /Falha ao recortar o clipe/,
  );
  assert.deepEqual(readdirSync(dir), []);
});
