import { mkdirSync, readdirSync, rmSync, rmdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RE_DIA = /^(\d{4})-(\d{2})-(\d{2})$/;
const RE_TRECHO = /^(\d{2})-(\d{2})-(\d{2})\.mp4$/;
const p2 = (n) => String(n).padStart(2, '0');

export function nomeDia(d) {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

/** Cria aovivo/ e as pastas de hoje e de amanhã (o ffmpeg não cria a pasta do dia). */
export function garantirPastas(pasta, agora = new Date()) {
  mkdirSync(join(pasta, 'aovivo'), { recursive: true });
  const amanha = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1);
  for (const d of [agora, amanha]) mkdirSync(join(pasta, 'trechos', nomeDia(d)), { recursive: true });
}

/**
 * Buffer circular: apaga trechos cuja hora de início (pelo nome do arquivo,
 * hora local) é mais antiga que `bufferHoras`, e pastas de dia vazias (exceto
 * hoje e amanhã). Só mexe em `<pasta>/trechos/AAAA-MM-DD/HH-MM-SS.mp4`.
 */
export function limparTrechos({ pasta, bufferHoras, agora = new Date(), log = () => {} }) {
  const raiz = join(pasta, 'trechos');
  const limite = agora.getTime() - bufferHoras * 3600 * 1000;
  const manter = new Set([nomeDia(agora), nomeDia(new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1))]);
  let apagados = 0;
  let dias;
  try { dias = readdirSync(raiz); } catch { return { apagados }; }

  for (const dia of dias) {
    const md = dia.match(RE_DIA);
    if (!md) continue;
    const pastaDia = join(raiz, dia);
    try { if (!statSync(pastaDia).isDirectory()) continue; } catch { continue; }
    for (const arq of readdirSync(pastaDia)) {
      const mt = arq.match(RE_TRECHO);
      if (!mt) continue;
      const inicio = new Date(+md[1], +md[2] - 1, +md[3], +mt[1], +mt[2], +mt[3]).getTime();
      if (inicio < limite) {
        try { rmSync(join(pastaDia, arq), { force: true }); apagados++; }
        catch (e) { log(`Não consegui apagar ${dia}/${arq}: ${e.message}`); }
      }
    }
    if (!manter.has(dia) && readdirSync(pastaDia).length === 0) {
      try { rmdirSync(pastaDia); } catch { /* não está vazia ou em uso */ }
    }
  }
  if (apagados) log(`Limpeza: ${apagados} trecho(s) além de ${bufferHoras} h apagado(s).`);
  return { apagados };
}
