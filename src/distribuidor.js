/**
 * Distribuidor do áudio ao vivo (PCM s16le mono, `ouvirHz`).
 *
 * O ffmpeg manda o PCM pelo stdout; o supervisor entrega cada bloco a
 * `publicar`. Quem quiser o áudio (ouvir no PC, ROCKY-2 para detectar latido,
 * ROCKY-3 para o site) usa `inscrever(fn)` — devolve a função de cancelar — ou
 * `ligarEscrita(stream)` para ligar direto a um stream de escrita (descarta
 * blocos enquanto o destino estiver lento, em vez de acumular memória).
 * Ligar e desligar inscritos não mexe no ffmpeg.
 */
export function criarDistribuidor() {
  const inscritos = new Set();

  function inscrever(fn) {
    inscritos.add(fn);
    return () => { inscritos.delete(fn); };
  }

  return {
    inscrever,
    ouvintes: () => inscritos.size,
    publicar(bloco) {
      for (const fn of [...inscritos]) {
        try { fn(bloco); } catch { /* um ouvinte com defeito não afeta os outros */ }
      }
    },
    ligarEscrita(escrita) {
      let cheia = false;
      const aoDrenar = () => { cheia = false; };
      const cancelar = inscrever((b) => {
        if (cheia) return;
        if (escrita.write(b) === false) cheia = true;
      });
      escrita.on('drain', aoDrenar);
      escrita.on('error', () => { cancelar(); });
      return () => { cancelar(); escrita.off?.('drain', aoDrenar); };
    },
  };
}
