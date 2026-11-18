export class ConfigErro extends Error {}

function mostrar(v) {
  try { const s = JSON.stringify(v); return s === undefined ? String(v) : s; } catch { return String(v); }
}

/**
 * Exige número de verdade (typeof 'number', finito). Recusa true, [5], "5", null, NaN e Infinity.
 * regras: { inteiro, min, minExclusivo, max, maxExclusivo, descricao } — `descricao` completa a frase
 * ("um número maior que zero"). Lança ConfigErro dizendo a chave e o valor recebido.
 */
export function exigirNumero(chave, valor, { inteiro = false, min, minExclusivo, max, maxExclusivo, descricao } = {}) {
  const ok = typeof valor === 'number' && Number.isFinite(valor)
    && (!inteiro || Number.isInteger(valor))
    && (min === undefined || valor >= min)
    && (minExclusivo === undefined || valor > minExclusivo)
    && (max === undefined || valor <= max)
    && (maxExclusivo === undefined || valor < maxExclusivo);
  if (ok) return valor;
  let desc = descricao;
  if (!desc) {
    const partes = [inteiro ? 'um número inteiro' : 'um número'];
    if (minExclusivo !== undefined) partes.push(minExclusivo === 0 ? 'maior que zero' : `maior que ${minExclusivo}`);
    if (min !== undefined) partes.push(min === 0 ? 'maior ou igual a zero' : `de ${min} para cima`);
    if (max !== undefined) partes.push(`até ${max}`);
    if (maxExclusivo !== undefined) partes.push(maxExclusivo === 0 ? 'negativo' : `menor que ${maxExclusivo}`);
    desc = partes.join(', ');
  }
  throw new ConfigErro(`Configuração inválida: "${chave}" precisa ser ${desc} (recebi ${mostrar(valor)}).`);
}
