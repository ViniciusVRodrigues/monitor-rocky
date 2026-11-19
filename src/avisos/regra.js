// Regra do aviso de som longo (ROCKY-6): intervalo mínimo entre avisos e janela de silêncio.
// Pura: o último aviso fica só em memória (reiniciar o monitor zera).

function minutos(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? '').trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * @param {object} o
 * @param {number} o.intervaloMs        tempo mínimo entre dois avisos
 * @param {string} [o.silencioInicio]   'HH:MM' (hora local); vazio = sem silêncio
 * @param {string} [o.silencioFim]      'HH:MM'; a janela é [inicio, fim) e pode cruzar a meia-noite
 */
export function criarRegra({ intervaloMs, silencioInicio = '', silencioFim = '' }) {
  const ini = minutos(silencioInicio);
  const fim = minutos(silencioFim);
  const temSilencio = ini !== null && fim !== null && ini !== fim;
  let ultimo = null;

  function noSilencio(agora) {
    if (!temSilencio) return false;
    const m = agora.getHours() * 60 + agora.getMinutes();
    return ini < fim ? m >= ini && m < fim : m >= ini || m < fim;
  }

  return {
    /** true marca o instante como o último aviso; false não marca nada. */
    permitir(agora) {
      if (noSilencio(agora)) return false;
      const t = agora.getTime();
      if (intervaloMs > 0 && ultimo !== null && t - ultimo < intervaloMs) return false;
      ultimo = t;
      return true;
    },
  };
}

const dois = (n) => String(n).padStart(2, '0');

/** Payload do push; a hora é a do início do som. */
export function textoAviso({ segundos, inicio }) {
  return {
    titulo: 'Rocky',
    corpo: `Barulho há ${Math.round(segundos)} s seguidos (${dois(inicio.getHours())}:${dois(inicio.getMinutes())}). Toque para ver.`,
    url: '/',
    tag: 'rocky-som',
  };
}
