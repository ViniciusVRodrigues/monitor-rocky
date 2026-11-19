// Agrega atividades soltas em eventos (início, fim, intensidade máxima).

/**
 * @param {object} o
 * @param {string} o.tipo      'som' ou 'movimento'
 * @param {number} o.juntarMs  atividades mais próximas que isso viram um evento só
 * @param {number} o.maxMs     duração máxima de um evento
 * @param {(e:{tipo:string,inicio:number,fim:number,intensidade:number,picoMs:number})=>void} o.aoFechar
 *   picoMs = instante da maior intensidade (para a miniatura)
 */
export function criarAgregador({ tipo, juntarMs, maxMs, aoFechar }) {
  let evento = null;

  function fechar() {
    if (!evento) return;
    const e = { tipo, inicio: evento.inicio, fim: evento.fim, intensidade: evento.intensidade, picoMs: evento.picoMs };
    evento = null;
    try {
      aoFechar(e);
    } catch {
      // o agregador nunca quebra por erro de quem ouve
    }
  }

  function atividade(t, intensidade) {
    if (evento && (t - evento.fim >= juntarMs || t - evento.inicio > maxMs)) fechar();
    if (!evento) {
      evento = { inicio: t, fim: t, intensidade, picoMs: t };
      return;
    }
    evento.fim = Math.max(evento.fim, t);
    if (intensidade > evento.intensidade) { evento.intensidade = intensidade; evento.picoMs = t; }
  }

  function verificar(agoraMs) {
    if (!evento) return;
    if (agoraMs - evento.fim >= juntarMs || evento.fim - evento.inicio >= maxMs) fechar();
  }

  return {
    atividade, verificar, encerrar: fechar,
    aberto: () => evento !== null,
    /** Cópia de { inicio, fim } do evento aberto, ou null. */
    atual: () => (evento ? { inicio: evento.inicio, fim: evento.fim } : null),
  };
}
