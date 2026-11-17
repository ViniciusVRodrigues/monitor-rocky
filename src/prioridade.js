import { constants, setPriority } from 'node:os';

const MAPA = {
  abaixo: constants.priority.PRIORITY_BELOW_NORMAL,
  normal: constants.priority.PRIORITY_NORMAL,
  acima: constants.priority.PRIORITY_ABOVE_NORMAL,
  alta: constants.priority.PRIORITY_HIGH,
};

/** 'abaixo' | 'normal' | 'acima' | 'alta' -> constante do SO; qualquer outra coisa -> undefined (nunca tempo real). */
export function mapearPrioridade(nome) {
  return typeof nome === 'string' && Object.hasOwn(MAPA, nome) ? MAPA[nome] : undefined;
}

/** Ajusta a prioridade do processo `pid`. Nunca lança: falha vai ao `log`. Devolve true se ajustou. */
export function aplicarPrioridade({ pid, nome, definir = setPriority, log = () => {} }) {
  const valor = mapearPrioridade(nome);
  if (valor === undefined || !pid) return false;
  try { definir(pid, valor); return true; }
  catch (e) { try { log(`Não consegui ajustar a prioridade do processo ${pid}: ${e.message}`); } catch { /* ignora */ } return false; }
}
