import { readFileSync, writeFileSync, renameSync, rmSync, existsSync, readdirSync, statSync, realpathSync, lstatSync } from 'node:fs';
import { copyFile, mkdir, writeFile, rename, rm } from 'node:fs/promises';
import { join, dirname, extname, basename } from 'node:path';
import { randomBytes } from 'node:crypto';
import { resolverGravacao, segmentosSeguros } from './arquivos.js';
import { diaValido, lerDia, soAudio } from './linha-tempo.js';

/** Erro com status HTTP, para as rotas de apagar e guardar. */
export class GravacaoErro extends Error {
  constructor(status, msg) { super(msg); this.status = status; }
}

const NOME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const RESERVADAS = ['trechos', 'clipes', 'eventos', 'aovivo'];
const ROTULO_MAX = 80;
const META = 'guardado.json';
const META_MAX = 64 * 1024;

/** Nome da subpasta dos guardados (dentro de `pasta`), já validado. */
export function nomeGuardados(cfg) {
  const n = cfg.guardadosPasta ?? 'guardados';
  if (typeof n !== 'string' || !NOME.test(n) || RESERVADAS.includes(n.toLowerCase())) {
    throw new Error('"guardadosPasta" precisa ser um nome simples de pasta, diferente de trechos, clipes, eventos e aovivo.');
  }
  return n;
}

function exigirDia(dia) {
  if (typeof dia !== 'string' || !diaValido(dia)) throw new GravacaoErro(400, 'Dia inválido.');
}

/** Apaga um arquivo; true se apagou ou já não existia. */
function apagarArquivo(arquivo) {
  try {
    rmSync(arquivo, { force: true, maxRetries: 3, retryDelay: 100 });
    return !existsSync(arquivo);
  } catch { return false; }
}

/**
 * Caminho absoluto de um arquivo de clipe (vídeo ou miniatura) citado no registro,
 * só se ficar dentro de clipes/. Qualquer outra coisa vira null e não é apagada.
 */
function arquivoDeClipe(pasta, valor) {
  if (typeof valor !== 'string' || !valor) return null;
  let v = valor.replaceAll('\\', '/');
  if (!v.startsWith('/arquivos/')) v = `/arquivos/${v.replace(/^\/+/, '')}`;
  const segs = segmentosSeguros(v);
  if (!segs || segs[1] !== 'clipes') return null;
  return resolverGravacao(pasta, v)?.arquivo ?? null;
}

/** Lê o jsonl do dia como linhas cruas, cada uma com o id (como /api/dia o calcula) e o objeto. */
function linhasDoDia(pasta, dia) {
  const arquivo = join(pasta, 'eventos', `${dia}.jsonl`);
  let txt;
  try { txt = readFileSync(arquivo, 'utf8'); } catch { return null; }
  const linhas = txt.split('\n').map((cru, i) => {
    let obj = null;
    if (cru.trim()) { try { obj = JSON.parse(cru); } catch { obj = null; } }
    const ok = obj && typeof obj === 'object';
    return { cru, obj: ok ? obj : null, id: ok ? (obj.id !== undefined ? String(obj.id) : `${dia}-${i}`) : null };
  });
  return { arquivo, linhas };
}

/** Regrava o jsonl de uma vez (tmp + rename; se o rename falhar, escreve por cima). */
function regravar(arquivo, linhas) {
  const txt = linhas.map((l) => l.cru).join('\n');
  const tmp = `${arquivo}.${process.pid}.tmp`;
  try {
    writeFileSync(tmp, txt);
    renameSync(tmp, arquivo);
  } catch {
    try { rmSync(tmp, { force: true }); } catch { /* ignora */ }
    writeFileSync(arquivo, txt);
  }
}

/** Apaga os eventos escolhidos: arquivos do clipe primeiro; a linha só sai se os arquivos saíram. */
function apagarEventos(pasta, doc, escolher) {
  let eventos = 0; let arquivos = 0; let falhas = 0;
  const ficam = [];
  for (const l of doc.linhas) {
    if (!l.obj || !escolher(l)) { ficam.push(l); continue; }
    let tudo = true;
    for (const campo of ['clipe', 'miniatura']) {
      const f = arquivoDeClipe(pasta, l.obj[campo]);
      if (!f) continue;
      if (apagarArquivo(f)) arquivos++; else { tudo = false; falhas++; }
    }
    if (tudo) eventos++; else ficam.push(l);
  }
  if (eventos) regravar(doc.arquivo, ficam);
  return { eventos, arquivos, falhas };
}

/** POST /api/apagar/evento {dia, id}. */
export function apagarEvento(pasta, corpo) {
  exigirDia(corpo?.dia);
  const id = corpo.id;
  if (typeof id !== 'string' || !id || id.length > 200) throw new GravacaoErro(400, 'Evento inválido.');
  const doc = linhasDoDia(pasta, corpo.dia);
  if (!doc || !doc.linhas.some((l) => l.obj && l.id === id)) throw new GravacaoErro(404, 'Esse evento não existe mais.');
  const r = apagarEventos(pasta, doc, (l) => l.id === id);
  return { ok: r.falhas === 0, ...r };
}

/**
 * POST /api/apagar/hora {dia, hora, trechos?, ids?}. A hora é a do texto de `inicio`
 * (como a página agrupa). `ids`, se vier, limita aos eventos que a página contou.
 * `trechos: true` apaga também a gravação contínua da hora, menos o trecho em andamento.
 */
export function apagarHora(pasta, corpo, { agora = new Date(), trechoSegundos = 60 } = {}) {
  exigirDia(corpo?.dia);
  const { hora } = corpo;
  if (!Number.isInteger(hora) || hora < 0 || hora > 23) throw new GravacaoErro(400, 'Hora inválida.');
  let ids = null;
  if (corpo.ids !== undefined) {
    if (!Array.isArray(corpo.ids) || !corpo.ids.every((x) => typeof x === 'string')) throw new GravacaoErro(400, 'Lista de eventos inválida.');
    ids = new Set(corpo.ids);
  }
  if (corpo.trechos !== undefined && typeof corpo.trechos !== 'boolean') throw new GravacaoErro(400, 'Pedido inválido.');
  const hh = String(hora).padStart(2, '0');
  const r = { eventos: 0, arquivos: 0, trechos: 0, emAndamento: 0, falhas: 0 };
  const doc = linhasDoDia(pasta, corpo.dia);
  if (doc) {
    const e = apagarEventos(pasta, doc, (l) => typeof l.obj.inicio === 'string' && l.obj.inicio.slice(11, 13) === hh &&
      (!ids || ids.has(l.id)));
    r.eventos = e.eventos; r.arquivos = e.arquivos; r.falhas += e.falhas;
  }
  if (corpo.trechos) {
    for (const t of lerDia(pasta, corpo.dia, { agora, trechoSegundos }).trechos) {
      if (t.inicio.slice(0, 2) !== hh) continue;
      if (t.emAndamento) { r.emAndamento++; continue; }
      const f = resolverGravacao(pasta, t.url)?.arquivo;
      if (f && apagarArquivo(f)) r.trechos++; else r.falhas++;
    }
  }
  return { ok: r.falhas === 0, ...r };
}

// ---------------------------------------------------------------- guardados

function pastaGuardados(cfg) { return join(cfg.pasta, nomeGuardados(cfg)); }

function limparRotulo(v, padrao) {
  if (typeof v !== 'string') return padrao;
  const t = v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, ROTULO_MAX);
  return t || padrao;
}

function lerMeta(dir) {
  try {
    const f = join(dir, META);
    if (statSync(f).size > META_MAX) return {};
    const o = JSON.parse(readFileSync(f, 'utf8'));
    return o && typeof o === 'object' ? o : {};
  } catch { return {}; }
}

/** Um guardado como a API o mostra, ou null se a pasta não tem vídeo. */
function descrever(base, nome) {
  const dir = join(base, nome);
  let entradas;
  try { entradas = readdirSync(dir, { withFileTypes: true }); } catch { return null; }
  const arquivos = [];
  let miniatura = null;
  for (const e of entradas.sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (!e.isFile() || !NOME.test(e.name)) continue;
    const ext = extname(e.name);
    const url = `/arquivos/guardados/${nome}/${e.name}`;
    if (ext === '.jpg') { miniatura ??= url; continue; }
    if (ext !== '.mp4') continue;
    let st; try { st = statSync(join(dir, e.name)); } catch { continue; }
    arquivos.push({ url, nome: e.name, bytes: st.size, soAudio: soAudio(join(dir, e.name), st.size, st.mtimeMs) });
  }
  if (!arquivos.length) return null;
  const meta = lerMeta(dir);
  let criado = typeof meta.criado === 'string' ? meta.criado : null;
  if (!criado) { try { criado = statSync(dir).mtime.toISOString(); } catch { criado = null; } }
  const origens = Array.isArray(meta.origens) ? meta.origens.filter((x) => typeof x === 'string') : [];
  return {
    nome, rotulo: limparRotulo(meta.rotulo, nome), criado, arquivos, miniatura,
    bytes: arquivos.reduce((s, a) => s + a.bytes, 0), origens,
  };
}

/** GET /api/guardados: as pastas com vídeo, mais novas primeiro (as feitas à mão também). */
export function listarGuardados(cfg) {
  const base = pastaGuardados(cfg);
  let entradas;
  try { entradas = readdirSync(base, { withFileTypes: true }); } catch { return { guardados: [] }; }
  const lista = entradas.filter((e) => e.isDirectory() && NOME.test(e.name))
    .map((e) => descrever(base, e.name)).filter(Boolean);
  lista.sort((a, b) => String(b.criado).localeCompare(String(a.criado)) || (a.nome < b.nome ? -1 : 1));
  return { guardados: lista };
}

/** Valida as urls de /api/guardar e devolve [{url, dia, tipo, nome, arquivo}]. */
function validarOrigens(cfg, urls) {
  const max = cfg.guardarMaxArquivos ?? 120;
  if (!Array.isArray(urls) || !urls.length) throw new GravacaoErro(400, 'Nada para guardar.');
  if (urls.length > max) throw new GravacaoErro(400, `Dá para guardar no máximo ${max} arquivos de uma vez.`);
  if (new Set(urls).size !== urls.length) throw new GravacaoErro(400, 'Arquivo repetido no pedido.');
  return urls.map((url) => {
    const segs = typeof url === 'string' ? segmentosSeguros(url) : null;
    if (!segs || segs.length !== 4 || segs[0] !== 'arquivos' || (segs[1] !== 'trechos' && segs[1] !== 'clipes') ||
        !diaValido(segs[2]) || extname(segs[3]) !== '.mp4') {
      throw new GravacaoErro(400, 'Só dá para guardar trechos e clipes.');
    }
    const r = resolverGravacao(cfg.pasta, url);
    if (!r) throw new GravacaoErro(400, 'Esse arquivo não existe mais.');
    return { url, tipo: segs[1], dia: segs[2], nome: segs[3], arquivo: r.arquivo };
  });
}

/** POST /api/guardar {urls, rotulo}: copia para guardados/<nome>/ (fora da limpeza). */
export async function guardar(cfg, corpo, { agora = new Date() } = {}) {
  const origens = validarOrigens(cfg, corpo?.urls);
  // O trecho que ainda está sendo gravado fica de fora (a cópia sairia cortada).
  const andamento = new Set();
  for (const dia of new Set(origens.filter((o) => o.tipo === 'trechos').map((o) => o.dia))) {
    for (const t of lerDia(cfg.pasta, dia, { agora, trechoSegundos: cfg.trechoSegundos ?? 60 }).trechos) {
      if (t.emAndamento) andamento.add(t.url);
    }
  }
  const copiar = origens.filter((o) => !andamento.has(o.url));
  if (!copiar.length) throw new GravacaoErro(409, 'Esse trecho ainda está sendo gravado. Tente de novo daqui a pouco.');

  const base = pastaGuardados(cfg);
  await mkdir(base, { recursive: true });
  const primeiro = copiar[0];
  const raiz = `${primeiro.dia}_${basename(primeiro.nome, '.mp4')}`;
  const tmp = join(base, `.tmp-${randomBytes(6).toString('hex')}`);
  await mkdir(tmp);
  try {
    for (const o of copiar) {
      await copyFile(o.arquivo, join(tmp, `${o.dia}_${o.nome}`));
      if (o.tipo === 'clipes') {
        const jpg = o.arquivo.replace(/\.mp4$/i, '.jpg');
        if (existsSync(jpg)) await copyFile(jpg, join(tmp, `${o.dia}_${basename(o.nome, '.mp4')}.jpg`));
      }
    }
    const meta = {
      rotulo: limparRotulo(corpo.rotulo, raiz),
      criado: agora.toISOString(),
      origens: copiar.map((o) => o.url),
    };
    await writeFile(join(tmp, META), JSON.stringify(meta, null, 2));
    let nome = raiz;
    for (let n = 2; existsSync(join(base, nome)); n++) nome = `${raiz}-${n}`;
    await rename(tmp, join(base, nome));
    return { ok: true, guardado: descrever(base, nome), pulados: origens.length - copiar.length };
  } catch (e) {
    await rm(tmp, { recursive: true, force: true }).catch(() => {});
    if (e instanceof GravacaoErro) throw e;
    throw new GravacaoErro(500, 'Não consegui guardar.');
  }
}

/** POST /api/guardados/apagar {nome}: apaga uma pasta de guardados (só filho direto). */
export function apagarGuardado(cfg, corpo) {
  const nome = corpo?.nome;
  if (typeof nome !== 'string' || !NOME.test(nome) || nome.length > 200) throw new GravacaoErro(400, 'Nome inválido.');
  const base = pastaGuardados(cfg);
  let baseReal; let alvoReal;
  try {
    baseReal = realpathSync(base);
    const alvo = join(baseReal, nome);
    if (lstatSync(alvo).isSymbolicLink()) throw new GravacaoErro(400, 'Nome inválido.');
    alvoReal = realpathSync(alvo);
  } catch (e) {
    if (e instanceof GravacaoErro) throw e;
    throw new GravacaoErro(404, 'Essa pasta não existe mais.');
  }
  if (dirname(alvoReal).toLowerCase() !== baseReal.toLowerCase() || !statSync(alvoReal).isDirectory()) {
    throw new GravacaoErro(404, 'Essa pasta não existe mais.');
  }
  try { rmSync(alvoReal, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch { /* confere abaixo */ }
  if (existsSync(alvoReal)) throw new GravacaoErro(500, 'Não consegui apagar a pasta inteira. Feche o que estiver usando os arquivos e tente de novo.');
  return { ok: true };
}
