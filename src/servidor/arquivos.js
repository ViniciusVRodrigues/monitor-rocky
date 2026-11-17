import { createReadStream, realpathSync, statSync } from 'node:fs';
import { join, resolve, sep, extname } from 'node:path';

const MIME = {
  '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.m3u8': 'application/vnd.apple.mpegurl', '.ts': 'video/mp2t',
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json; charset=utf-8',
};
const NOME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const EXT_ESTATICO = ['.html', '.css', '.js', '.svg', '.png', '.ico', '.webmanifest'];

function dentro(base, alvo) {
  return alvo.toLowerCase().startsWith((base.endsWith(sep) ? base : base + sep).toLowerCase());
}

/**
 * Converte o caminho cru da URL (ainda codificado) em segmentos seguros, ou null.
 * Decodifica uma vez; recusa barra invertida, byte nulo, dois-pontos, '%' restante
 * (dupla codificação), '.' e '..', e segmentos vazios ou fora do padrão de nome.
 */
export function segmentosSeguros(caminhoCru) {
  let dec;
  try { dec = decodeURIComponent(caminhoCru); } catch { return null; }
  if (/[\\\0:%]/.test(dec)) return null;
  if (!dec.startsWith('/')) return null;
  const segs = dec.slice(1).split('/');
  for (const s of segs) if (!NOME.test(s)) return null;
  return segs;
}

/** Resolve `segs` dentro de `base`, com realpath e prefixo. Devolve { arquivo, tamanho, mtimeMs } ou null. */
function resolverDentro(base, segs) {
  try {
    const baseReal = realpathSync(base);
    const alvo = resolve(baseReal, ...segs);
    if (!dentro(baseReal, alvo)) return null;
    const real = realpathSync(alvo);
    if (!dentro(baseReal, real)) return null;
    const st = statSync(real);
    if (!st.isFile()) return null;
    return { arquivo: real, tamanho: st.size, mtimeMs: st.mtimeMs };
  } catch { return null; }
}

/**
 * /arquivos/{trechos|clipes}/<dia>/<nome>.{mp4,jpg}, /arquivos/guardados/<pasta>/<nome>.{mp4,jpg}
 * e /aovivo/<nome>.{m3u8,ts}. `caminhoCru` é o pathname da URL, sem a query.
 * `guardados` é o nome da subpasta dos guardados (chave `guardadosPasta`).
 */
export function resolverGravacao(pasta, caminhoCru, guardados = 'guardados') {
  const segs = segmentosSeguros(caminhoCru);
  if (!segs) return null;
  const ext = extname(segs[segs.length - 1]);
  if (segs[0] === 'arquivos') {
    if (segs.length !== 4 || (segs[1] !== 'trechos' && segs[1] !== 'clipes' && segs[1] !== 'guardados')) return null;
    if (ext !== '.mp4' && ext !== '.jpg') return null;
    const r = resolverDentro(join(pasta, segs[1] === 'guardados' ? guardados : segs[1]), segs.slice(2));
    return r && { ...r, mime: MIME[ext], cache: 'no-cache' };
  }
  if (segs[0] === 'aovivo') {
    if (segs.length !== 2 || (ext !== '.m3u8' && ext !== '.ts')) return null;
    const r = resolverDentro(join(pasta, 'aovivo'), segs.slice(1));
    return r && { ...r, mime: MIME[ext], cache: 'no-store' };
  }
  return null;
}

/** Arquivos da página (whitelist): /, /<arq>, /js/<arq>, /img/<arq>. */
export function resolverEstatico(raiz, caminhoCru) {
  const segs = segmentosSeguros(caminhoCru === '/' ? '/index.html' : caminhoCru);
  if (!segs || segs.length > 2) return null;
  if (segs.length === 2 && segs[0] !== 'js' && segs[0] !== 'img') return null;
  const ext = extname(segs[segs.length - 1]);
  if (!EXT_ESTATICO.includes(ext)) return null;
  const r = resolverDentro(join(raiz, 'web'), segs);
  return r && { ...r, mime: MIME[ext], cache: 'no-cache' };
}

export function resolverVendor(raiz, caminhoCru) {
  if (caminhoCru !== '/vendor/hls.min.js') return null;
  const r = resolverDentro(join(raiz, 'node_modules', 'hls.js', 'dist'), ['hls.min.js']);
  return r && { ...r, mime: MIME['.js'], cache: 'no-cache' };
}

/** Interpreta `Range` de um intervalo: {inicio,fim}, 'invalido' (416) ou null (ignorar). */
export function lerRange(cabecalho, tamanho) {
  if (!cabecalho) return null;
  const txt = String(cabecalho).trim();
  if (!txt.startsWith('bytes=') || txt.includes(',')) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(txt);
  if (!m || (m[1] === '' && m[2] === '')) return 'invalido';
  let inicio; let fim;
  if (m[1] === '') {
    const n = Number(m[2]);
    if (n === 0) return 'invalido';
    inicio = Math.max(0, tamanho - n); fim = tamanho - 1;
  } else {
    inicio = Number(m[1]);
    fim = m[2] === '' ? tamanho - 1 : Math.min(Number(m[2]), tamanho - 1);
  }
  if (inicio >= tamanho || inicio > fim) return 'invalido';
  return { inicio, fim };
}

/** Serve o arquivo resolvido, com Range (206/416) e HEAD. */
export function servirArquivo(req, res, r) {
  const base = { 'Content-Type': r.mime, 'Accept-Ranges': 'bytes', 'Cache-Control': r.cache };
  const range = lerRange(req.headers.range, r.tamanho);
  if (range === 'invalido') {
    res.writeHead(416, { ...base, 'Content-Range': `bytes */${r.tamanho}` });
    return res.end();
  }
  let status = 200; let inicio = 0; let fim = r.tamanho - 1;
  const cab = { ...base };
  if (range) {
    status = 206; ({ inicio, fim } = range);
    cab['Content-Range'] = `bytes ${inicio}-${fim}/${r.tamanho}`;
  }
  cab['Content-Length'] = r.tamanho === 0 ? 0 : fim - inicio + 1;
  res.writeHead(status, cab);
  if (req.method === 'HEAD' || r.tamanho === 0) return res.end();
  const s = createReadStream(r.arquivo, { start: inicio, end: fim });
  s.on('error', () => res.destroy());
  res.on('close', () => s.destroy());
  s.pipe(res);
}
