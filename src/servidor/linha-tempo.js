import { readdirSync, readFileSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { join } from 'node:path';
import { resolverGravacao } from './arquivos.js';

const DIA = /^(\d{4})-(\d{2})-(\d{2})$/;
const TRECHO = /^(\d{2})-(\d{2})-(\d{2})\.mp4$/;
const MIN_BYTES = 1024;
const SNIFF_BYTES = 64 * 1024;
const CACHE_MAX = 5000;
const cacheSoAudio = new Map();

export function diaValido(s) {
  const m = DIA.exec(String(s));
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

export function diaLocal(data) {
  const p = (n) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}`;
}

function listar(dir) {
  try { return readdirSync(dir, { withFileTypes: true }); } catch { return []; }
}

/** Dias com pasta em trechos/ ou clipes/, ou arquivo em eventos/; decrescente. `hoje` sempre vem. */
export function listarDias(pasta, agora = new Date()) {
  const dias = new Set();
  for (const sub of ['trechos', 'clipes']) {
    for (const e of listar(join(pasta, sub))) if (e.isDirectory() && diaValido(e.name)) dias.add(e.name);
  }
  for (const e of listar(join(pasta, 'eventos'))) {
    const m = /^(\d{4}-\d{2}-\d{2})\.jsonl$/.exec(e.name);
    if (e.isFile() && m && diaValido(m[1])) dias.add(m[1]);
  }
  // A captura cria de véspera a pasta do dia seguinte (vazia): dias futuros não entram.
  const hoje = diaLocal(agora);
  dias.add(hoje);
  return { dias: [...dias].filter((d) => d <= hoje).sort().reverse(), hoje };
}

/** true se o MP4 não tem trilha de vídeo (hdlr 'vide' nos primeiros 64 KB). Resultado em cache. */
export function soAudio(arquivo, bytes, mtimeMs) {
  const chave = `${arquivo}|${bytes}|${mtimeMs}`;
  if (cacheSoAudio.has(chave)) return cacheSoAudio.get(chave);
  let r = false;
  let fd;
  try {
    fd = openSync(arquivo, 'r');
    const buf = Buffer.alloc(Math.min(SNIFF_BYTES, bytes));
    const n = readSync(fd, buf, 0, buf.length, 0);
    let achou = false; let video = false;
    for (let i = buf.indexOf('hdlr'); i >= 0 && i + 16 <= n; i = buf.indexOf('hdlr', i + 4)) {
      achou = true;
      if (buf.toString('latin1', i + 12, i + 16) === 'vide') video = true;
    }
    r = achou && !video;
  } catch { r = false; } finally { if (fd !== undefined) try { closeSync(fd); } catch { /* ignora */ } }
  if (cacheSoAudio.size >= CACHE_MAX) cacheSoAudio.clear();
  cacheSoAudio.set(chave, r);
  return r;
}

function listarTrechos(pasta, dia, agora, trechoSegundos) {
  const dir = join(pasta, 'trechos', dia);
  const itens = [];
  for (const e of listar(dir)) {
    const m = TRECHO.exec(e.name);
    if (!e.isFile() || !m || +m[1] > 23 || +m[2] > 59 || +m[3] > 59) continue;
    let st;
    try { st = statSync(join(dir, e.name)); } catch { continue; }
    if (st.size < MIN_BYTES) continue;
    itens.push({ nome: e.name, st, arquivo: join(dir, e.name) });
  }
  itens.sort((a, b) => (a.nome < b.nome ? -1 : 1));
  const ehHoje = dia === diaLocal(agora);
  return itens.map((it, i) => ({
    inicio: it.nome.slice(0, 8).replaceAll('-', ':'),
    url: `/arquivos/trechos/${dia}/${it.nome}`,
    soAudio: soAudio(it.arquivo, it.st.size, it.st.mtimeMs),
    emAndamento: ehHoje && i === itens.length - 1 && agora.getTime() - it.st.mtimeMs < (trechoSegundos + 10) * 1000,
    bytes: it.st.size,
  }));
}

function urlGravacao(pasta, valor) {
  if (typeof valor !== 'string' || !valor) return null;
  let v = valor.replaceAll('\\', '/');
  if (!v.startsWith('/arquivos/')) v = `/arquivos/${v.replace(/^\/+/, '')}`;
  return resolverGravacao(pasta, v) ? v : null;
}

function lerEventos(pasta, dia) {
  let txt;
  try { txt = readFileSync(join(pasta, 'eventos', `${dia}.jsonl`), 'utf8'); } catch { return []; }
  const lista = [];
  txt.split('\n').forEach((linha, i) => {
    if (!linha.trim()) return;
    let o;
    try { o = JSON.parse(linha); } catch { return; }
    if (!o || typeof o !== 'object') return;
    if (o.tipo !== 'movimento' && o.tipo !== 'som') return;
    if (typeof o.intensidade !== 'number' || !Number.isFinite(o.intensidade)) return;
    if (typeof o.inicio !== 'string' || Number.isNaN(Date.parse(o.inicio))) return;
    lista.push({
      id: o.id !== undefined ? String(o.id) : `${dia}-${i}`,
      inicio: o.inicio,
      fim: typeof o.fim === 'string' ? o.fim : o.inicio,
      tipo: o.tipo,
      intensidade: Math.min(1, Math.max(0, o.intensidade)),
      clipe: urlGravacao(pasta, o.clipe),
      miniatura: urlGravacao(pasta, o.miniatura),
    });
  });
  return lista.sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio));
}

/** Monta a resposta de /api/dia/AAAA-MM-DD (o dia já validado). */
export function lerDia(pasta, dia, { agora = new Date(), trechoSegundos = 60 } = {}) {
  return {
    dia,
    hoje: dia === diaLocal(agora),
    trechos: listarTrechos(pasta, dia, agora, trechoSegundos),
    eventos: lerEventos(pasta, dia),
  };
}

/** Normaliza um evento vindo de `aoEvento` para o formato da API (ou null). */
export function normalizarEvento(pasta, o) {
  if (!o || typeof o !== 'object' || (o.tipo !== 'movimento' && o.tipo !== 'som')) return null;
  if (typeof o.intensidade !== 'number' || !Number.isFinite(o.intensidade)) return null;
  const inicio = typeof o.inicio === 'string' ? o.inicio : new Date().toISOString();
  return {
    id: o.id !== undefined ? String(o.id) : inicio,
    inicio,
    fim: typeof o.fim === 'string' ? o.fim : inicio,
    tipo: o.tipo,
    intensidade: Math.min(1, Math.max(0, o.intensidade)),
    clipe: urlGravacao(pasta, o.clipe),
    miniatura: urlGravacao(pasta, o.miniatura),
  };
}
