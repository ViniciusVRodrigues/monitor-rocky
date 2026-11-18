/**
 * Caminhos, linha do registro (jsonl) e retenção dos clipes de eventos.
 * Contrato em openspec/changes/deteccao-eventos/design.md.
 */
import { appendFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, statfsSync } from 'node:fs';
import { join } from 'node:path';
import { isoLocal, nomeDia, nomeHora } from './tempo.js';

const RE_DIA = /^(\d{4})-(\d{2})-(\d{2})$/;
const RE_JSONL = /^(\d{4}-\d{2}-\d{2})\.jsonl$/;

// Nomes já dados nesta execução: um recorte que falhou não deixa .mp4, mas o id não pode se repetir.
const usados = new Set();

export function caminhosEvento({ pasta, evento, preMs }) {
  const d = new Date(evento.inicio - preMs);
  const dia = nomeDia(d);
  const hora = nomeHora(d);
  const pastaDia = join(pasta, 'clipes', dia);
  mkdirSync(pastaDia, { recursive: true });
  let nome = `${hora}-${evento.tipo}`;
  let n = 1;
  const ocupado = (n) => usados.has(join(pastaDia, n)) || existsSync(join(pastaDia, `${n}.mp4`));
  while (ocupado(nome)) {
    n++;
    nome = `${hora}-${evento.tipo}-${n}`;
  }
  usados.add(join(pastaDia, nome));
  return {
    id: `${dia}_${nome}`,
    dia,
    base: join(pastaDia, nome),
    relClipe: `clipes/${dia}/${nome}.mp4`,
    relMiniatura: `clipes/${dia}/${nome}.jpg`,
  };
}

export function montarRegistro({ id, evento, clipe, miniatura }) {
  const i = Number(evento.intensidade);
  return {
    id,
    inicio: isoLocal(new Date(evento.inicio)),
    fim: isoLocal(new Date(evento.fim)),
    tipo: evento.tipo,
    intensidade: Number.isFinite(i) ? Math.round(Math.min(1, Math.max(0, i)) * 1000) / 1000 : 0,
    clipe: clipe ?? null,
    miniatura: miniatura ?? null,
  };
}

/** Acrescenta uma linha inteira em eventos/<dia>.jsonl. */
export function anexarRegistro(pasta, dia, registro) {
  const dir = join(pasta, 'eventos');
  mkdirSync(dir, { recursive: true });
  appendFileSync(join(dir, `${dia}.jsonl`), JSON.stringify(registro) + '\n', 'utf8');
}

/** Retenção: apaga clipes e registros de dias anteriores a (hoje − dias). dias === 0: nunca apaga. */
export function limparClipes({ pasta, dias, agora = new Date(), log = () => {} }) {
  let apagados = 0;
  if (!dias || dias <= 0) return { apagados };
  const corte = nomeDia(new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - dias));
  if (!RE_DIA.test(corte)) { log(`Limpeza de clipes ignorada: "clipesDias" inválido (${dias}).`); return { apagados }; }
  const velho = (dia) => RE_DIA.test(dia) && dia < corte;

  let pastas = [];
  try { pastas = readdirSync(join(pasta, 'clipes'), { withFileTypes: true }); } catch { /* sem clipes */ }
  for (const e of pastas) {
    if (!e.isDirectory() || !velho(e.name)) continue;
    try { rmSync(join(pasta, 'clipes', e.name), { recursive: true, force: true }); apagados++; }
    catch (err) { log(`Não consegui apagar clipes/${e.name}: ${err.message}`); }
  }
  let arqs = [];
  try { arqs = readdirSync(join(pasta, 'eventos')); } catch { /* sem eventos */ }
  for (const nome of arqs) {
    const m = nome.match(RE_JSONL);
    if (!m || !velho(m[1])) continue;
    try { rmSync(join(pasta, 'eventos', nome), { force: true }); apagados++; }
    catch (err) { log(`Não consegui apagar eventos/${nome}: ${err.message}`); }
  }
  if (apagados) log(`Limpeza: ${apagados} item(ns) de clipes/eventos além de ${dias} dia(s) apagado(s).`);
  return { apagados };
}

const GB = 1024 ** 3;

/** Bytes de uma pasta, somando os arquivos de dentro (recursivo). Erro de leitura conta 0. */
function tamanhoPasta(dir) {
  let total = 0;
  let itens = [];
  try { itens = readdirSync(dir, { withFileTypes: true }); } catch { return 0; }
  for (const e of itens) {
    const p = join(dir, e.name);
    if (e.isDirectory()) total += tamanhoPasta(p);
    else { try { total += statSync(p).size; } catch { /* sumiu */ } }
  }
  return total;
}

/**
 * Retenção por espaço: apaga os dias de clipes mais antigos (pasta e .jsonl) enquanto
 * clipes/ passar de maxGb ou o disco tiver menos de livreMinGb livres. 0 = regra desligada.
 * Nunca toca no dia de hoje, em guardados/ nem em trechos/.
 * tamanhoDia(dir) e livreBytes() são injetáveis (testes).
 */
export function limparPorEspaco({
  pasta, maxGb = 0, livreMinGb = 0, agora = new Date(), log = () => {},
  tamanhoDia = tamanhoPasta, livreBytes = () => { const s = statfsSync(pasta); return Number(s.bavail) * Number(s.bsize); },
}) {
  const nada = { dias: [], gbLiberados: 0 };
  const limite = Number(maxGb) > 0 ? Number(maxGb) * GB : 0;
  const minimo = Number(livreMinGb) > 0 ? Number(livreMinGb) * GB : 0;
  if (!limite && !minimo) return nada;

  const hoje = nomeDia(agora);
  const dias = new Set();
  try { for (const e of readdirSync(join(pasta, 'clipes'), { withFileTypes: true })) if (e.isDirectory() && RE_DIA.test(e.name)) dias.add(e.name); } catch { /* sem clipes */ }
  try { for (const n of readdirSync(join(pasta, 'eventos'))) { const m = n.match(RE_JSONL); if (m) dias.add(m[1]); } } catch { /* sem eventos */ }
  const candidatos = [...dias].filter((d) => d < hoje).sort();
  const tamanhos = new Map();
  const dirDia = (d) => join(pasta, 'clipes', d);
  const medir = (d) => { if (!tamanhos.has(d)) tamanhos.set(d, tamanhoDia(dirDia(d))); return tamanhos.get(d); };

  let total = 0;
  if (limite) { for (const d of dias) total += medir(d); }
  const livre = () => livreBytes();
  const falta = () => {
    if (limite && total > limite) return 'limite';
    if (minimo && livre() < minimo) return 'livre';
    return null;
  };

  let motivo;
  try { motivo = falta(); }
  catch (e) { log(`Retenção por espaço ignorada: não consegui ler o espaço livre (${e.message}).`); return nada; }
  const primeiro = motivo;
  const apagados = [];
  let bytes = 0;
  for (const d of candidatos) {
    if (!motivo) break;
    const t = medir(d);
    try {
      rmSync(dirDia(d), { recursive: true, force: true });
      rmSync(join(pasta, 'eventos', `${d}.jsonl`), { force: true });
    } catch (err) { log(`Não consegui apagar o dia ${d} na limpeza por espaço: ${err.message}`); break; }
    apagados.push(d); bytes += t; total -= t;
    try { motivo = falta(); } catch { break; }
  }
  if (!apagados.length) return nada;
  const gb = bytes / GB;
  log(`Limpeza por espaço (${primeiro === 'limite' ? `clipes acima de ${maxGb} GB` : `disco livre abaixo de ${livreMinGb} GB`}): ${apagados.length} dia(s) apagado(s) (${apagados[0]} a ${apagados.at(-1)}), ${gb.toFixed(2)} GB liberados.`);
  return { dias: apagados, gbLiberados: gb };
}
