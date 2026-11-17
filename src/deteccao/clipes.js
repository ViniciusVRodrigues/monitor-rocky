/**
 * Recorte de clipes a partir dos trechos gravados (trechos/AAAA-MM-DD/HH-MM-SS.mp4).
 *
 * Checagem de trecho EM ANDAMENTO (ffmpeg 9, 2026-11-17, trecho fMP4 com
 * empty_moov + frag_keyframe, também via muxer segment/tee): enquanto o
 * ffmpeg escreve, o ffprobe lê o arquivo normalmente assim que o primeiro
 * fragmento sai (o `moov` vazio já está no começo) e a duração informada é a
 * do que já foi escrito. Nos primeiros ~2 s, só com o `ftyp` (28 bytes), o
 * ffprobe falha com "moov atom not found": esse trecho é ignorado, e o recorte
 * usa o que houver (a margem `clipeMargemSegundos` evita isso na prática).
 * Se a duração vier ausente, `duracaoS` é null e o recorte vai até o fim do
 * trecho.
 *
 * Concat demuxer: https://ffmpeg.org/ffmpeg-formats.html#concat (diretivas
 * `file`, `inpoint`, `outpoint`; `-safe 0` para caminhos absolutos).
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nomeDia } from './tempo.js';
import { aplicarPrioridade } from '../prioridade.js';

const RE_DIA = /^(\d{4})-(\d{2})-(\d{2})$/;
const RE_TRECHO = /^(\d{2})-(\d{2})-(\d{2})\.mp4$/;

function executar(cmd, args, { capturarStdout = false, prioridade = null, definirPrioridade, log } = {}) {
  return new Promise((resolve, reject) => {
    let p;
    try { p = spawn(cmd, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch (e) { reject(e); return; }
    aplicarPrioridade({ pid: p.pid, nome: prioridade, definir: definirPrioridade, log });
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => { if (capturarStdout) out += d; });
    p.stderr.on('data', (d) => { err += d; if (err.length > 20000) err = err.slice(-10000); });
    p.on('error', reject);
    p.on('close', (code) => resolve({ code, out, err }));
  });
}

async function sondar(arquivo, ffprobe) {
  try {
    const r = await executar(ffprobe, [
      '-v', 'error', '-show_entries', 'format=duration:stream=codec_type', '-of', 'json', arquivo,
    ], { capturarStdout: true });
    if (r.code !== 0) return null;
    const j = JSON.parse(r.out);
    const d = Number(j.format?.duration);
    return {
      duracaoS: Number.isFinite(d) && d > 0 ? d : null,
      temVideo: (j.streams ?? []).some((s) => s.codec_type === 'video'),
    };
  } catch { return null; }
}

/** Trechos que cruzam [inicioMs, fimMs], ordenados. */
export async function acharTrechos({ pasta, inicioMs, fimMs, ffprobe = 'ffprobe' }) {
  const dias = new Set();
  for (const ms of [inicioMs - 86400000, inicioMs, fimMs]) dias.add(nomeDia(new Date(ms)));
  const achados = [];
  for (const dia of dias) {
    const md = dia.match(RE_DIA);
    let nomes;
    try { nomes = readdirSync(join(pasta, 'trechos', dia)); } catch { continue; }
    for (const nome of nomes) {
      const mt = nome.match(RE_TRECHO);
      if (!mt) continue;
      const ini = new Date(+md[1], +md[2] - 1, +md[3], +mt[1], +mt[2], +mt[3]).getTime();
      if (ini > fimMs) continue;
      achados.push({ arquivo: join(pasta, 'trechos', dia, nome), inicioMs: ini });
    }
  }
  achados.sort((a, b) => a.inicioMs - b.inicioMs);
  const sondas = await Promise.all(achados.map((t) => sondar(t.arquivo, ffprobe)));
  const saida = [];
  achados.forEach((t, i) => {
    const s = sondas[i];
    if (!s) return;
    if (s.duracaoS !== null && t.inicioMs + s.duracaoS * 1000 < inicioMs) return;
    saida.push({ arquivo: t.arquivo, inicioMs: t.inicioMs, duracaoS: s.duracaoS, temVideo: s.temVideo });
  });
  return saida;
}

/** Caminho entre aspas simples para o ffconcat (aspas internas: '\''). */
const aspas = (s) => "'" + s.replace(/\\/g, '/').replace(/'/g, "'\\''") + "'";
const seg = (n) => (Math.round(n * 1000) / 1000).toFixed(3);

/**
 * Lista os trechos inteiros no ffconcat. O corte da janela é feito na saída
 * (-ss/-t, com decodificação): `inpoint` no concat cai no keyframe anterior
 * (GOP de 2 s) e deixava o clipe ~1 s mais longo (testado no ffmpeg 9).
 */
function montarConcat(trechos, inicioMs, fimMs) {
  const linhas = ['ffconcat version 1.0'];
  let duracaoTotal = 0;
  for (const t of trechos) {
    const dentro = Math.max(0, (inicioMs - t.inicioMs) / 1000);
    let fora = (fimMs - t.inicioMs) / 1000;
    if (t.duracaoS !== null) fora = Math.min(fora, t.duracaoS);
    linhas.push(`file ${aspas(t.arquivo)}`);
    duracaoTotal += Math.max(0, fora - dentro);
  }
  const deslocamento = Math.max(0, (inicioMs - trechos[0].inicioMs) / 1000);
  return { texto: linhas.join('\n') + '\n', duracaoTotal, deslocamento };
}

function falhou(o, r) {
  const fim = r.err.trim().split(/\r?\n/).slice(-6).join('\n');
  return new Error(`Falha ao ${o} (ffmpeg saiu com código ${r.code}):\n${fim}`);
}

/**
 * `executor` e `definirPrioridade` são injetáveis (testes). Os ffmpeg de clipe e de miniatura
 * sobem com `cfg.clipePrioridade` (padrão 'abaixo'); `cfg.clipeCopiar !== false` usa `-c copy`.
 */
export async function recortarClipe({ trechos, inicioMs, fimMs, destino, instanteMiniaturaMs, cfg, executor = executar, definirPrioridade }) {
  if (!trechos?.length) return { clipe: null, miniatura: null, soAudio: false };
  const ffmpeg = cfg.ffmpeg ?? 'ffmpeg';
  const extra = { prioridade: cfg.clipePrioridade ?? 'abaixo', definirPrioridade };
  const soAudio = trechos.some((t) => !t.temVideo);
  const tmp = `${destino}.tmp.mp4`;
  const final = `${destino}.mp4`;
  const { texto, duracaoTotal, deslocamento } = montarConcat(trechos, inicioMs, fimMs);
  const dirTmp = mkdtempSync(join(tmpdir(), 'rocky-concat-'));
  const lista = join(dirTmp, 'lista.ffconcat');
  try {
    writeFileSync(lista, texto, 'utf8');
    const base = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lista];
    const codec = soAudio
      ? ['-vn', '-map', '0:a:0?', '-c:a', 'aac', '-b:a', '96k']
      : cfg.clipeCopiar !== false
        ? ['-map', '0:v:0', '-map', '0:a:0?', '-c', 'copy']
        : [
        '-map', '0:v:0', '-map', '0:a:0?',
        '-c:v', 'libx264', '-preset', String(cfg.clipePreset ?? 'veryfast'),
        '-crf', String(cfg.clipeCrf ?? 26), '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k',
      ];
    const corte = ['-ss', seg(deslocamento), '-t', seg(duracaoTotal)];
    const r = await executor(ffmpeg, [...base, ...corte, ...codec, '-movflags', '+faststart', '-f', 'mp4', tmp], extra);
    if (r.code !== 0 || !existsSync(tmp)) throw falhou('recortar o clipe', r);
    renameSync(tmp, final);
  } catch (e) {
    rmSync(tmp, { force: true });
    throw e instanceof Error ? e : new Error(String(e));
  } finally {
    rmSync(dirTmp, { recursive: true, force: true });
  }
  if (soAudio) return { clipe: final, miniatura: null, soAudio: true };

  const inicioClipe = Math.max(inicioMs, trechos[0].inicioMs);
  let t = (instanteMiniaturaMs - inicioClipe) / 1000;
  if (!Number.isFinite(t) || t < 0 || t > duracaoTotal) t = duracaoTotal / 2;
  const jpg = `${destino}.jpg`;
  const gerar = (instante) => executor(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-y', '-ss', seg(instante), '-i', final,
    '-frames:v', '1', '-vf', `scale=${Number(cfg.miniaturaLargura ?? 320)}:-2`, '-q:v', '3', jpg,
  ], extra);
  let m = await gerar(t);
  if (!existsSync(jpg)) m = await gerar(0);
  if (!existsSync(jpg)) throw falhou('gerar a miniatura', m);
  return { clipe: final, miniatura: jpg, soAudio: false };
}
