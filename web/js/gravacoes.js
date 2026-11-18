// Apagar e guardar gravações: textos, contas e conjuntos de urls (sem DOM, testável em node).

const NAO_DESFAZ = 'Não dá para desfazer.';

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

/** "Apagar o clipe de Movimento das 16:04? Não dá para desfazer." */
export function textoConfirmaItem(tipo, hm) {
  return `Apagar o clipe de ${tipo} das ${hm}? ${NAO_DESFAZ}`;
}

/** Confirmação de "Apagar esta hora": "Apagar 5 clipes e 12 trechos das 16h?". `hora` já vem como "16h". */
export function textoConfirmaHora({ hora, clipes, trechos = 0, comGuardado = false }) {
  const partes = [];
  if (clipes > 0) partes.push(plural(clipes, 'clipe', 'clipes'));
  if (trechos > 0) partes.push(plural(trechos, 'trecho', 'trechos'));
  return `Apagar ${partes.join(' e ')} das ${hora}? ${NAO_DESFAZ}${comGuardado ? ' O que está em Guardados continua.' : ''}`;
}

export function textoConfirmaPasta(rotulo, trechos) {
  return `Apagar a pasta ${rotulo} com ${plural(trechos, 'trecho', 'trechos')}? ${NAO_DESFAZ}`;
}

/** Conjunto das urls de /arquivos/... que já foram guardadas. */
export function urlsGuardadas(guardados) {
  const s = new Set();
  for (const g of guardados || []) for (const u of g?.origens || []) s.add(u);
  return s;
}

/** Clipe ou bloco: guardado quando todas as urls estão guardadas. */
export function estaGuardado(urls, conjunto) {
  return urls.length > 0 && urls.every((u) => conjunto.has(u));
}

export function temGuardado(urls, conjunto) {
  return urls.some((u) => conjunto.has(u));
}

/** Há url em comum entre as duas listas (ou conjuntos)? */
export function cruza(a, b) {
  const conj = b instanceof Set ? b : new Set(b);
  for (const u of a) if (conj.has(u)) return true;
  return false;
}

/** "14 trechos · 14 min · com vídeo" ("só som" se todos são só áudio). */
export function notaGuardado(g, trechoSegundos) {
  const arq = g.arquivos || [];
  const n = arq.length;
  if (!n) return plural(0, 'trecho', 'trechos');
  const tipo = arq.every((a) => a.soAudio) ? 'só som' : 'com vídeo';
  const origens = g.origens || [];
  // Clipe guardado: a duração é a do clipe, não a dos trechos.
  if (origens.length && origens.every((u) => u.startsWith('/arquivos/clipes/'))) return `${plural(n, 'clipe', 'clipes')} · ${tipo}`;
  const min = Math.max(1, Math.round((n * trechoSegundos) / 60));
  return `${plural(n, 'trecho', 'trechos')} · ${min} min · ${tipo}`;
}

export function textoParcial(feitos, falhas) {
  return `Apaguei ${feitos} de ${feitos + falhas}. ${falhas} não deu para apagar.`;
}

export function textoFalhaApagar(erro) {
  return erro || 'Não consegui apagar. Nada foi apagado.';
}

export const anuncioItemApagado = (hm) => `Clipe das ${hm} apagado.`;
export function anuncioHoraApagada({ hora, clipes }) {
  if (!clipes) return `Gravação das ${hora} apagada.`;
  return `${clipes} ${clipes === 1 ? 'clipe das' : 'clipes das'} ${hora} ${clipes === 1 ? 'apagado' : 'apagados'}.`;
}
export const anuncioPastaApagada = (rotulo) => `Pasta ${rotulo} apagada.`;
export const anuncioGuardado = (o) => `${o} guardado em Guardados.`;
