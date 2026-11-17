/**
 * Caminhos, linha do registro (jsonl) e retenção dos clipes de eventos.
 * Contrato em openspec/changes/deteccao-eventos/design.md.
 */
import { appendFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
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
