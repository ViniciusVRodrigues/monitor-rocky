/**
 * Nível do som (função pura, sem relógio). Recebe blocos PCM s16le mono, em
 * qualquer tamanho (inclusive com byte ímpar entre blocos), e a cada janela de
 * `ouvirHz / nivelHz` amostras calcula o RMS em dBFS, mapeia [pisoDb, 0] em
 * [0, 1] e chama `aoNivel(n)`. A subida é imediata; a descida é
 * max(novo, anterior * suavizacao).
 */
export function criarNivel({ ouvirHz, nivelHz, suavizacao, pisoDb, aoNivel }) {
  const janela = Math.max(1, Math.round(ouvirHz / nivelHz));
  let soma = 0;
  let cont = 0;
  let sobra = null; // byte ímpar do bloco anterior
  let anterior = 0;

  function fechar() {
    const rms = Math.sqrt(soma / cont) / 32768;
    const db = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
    const novo = Math.min(1, Math.max(0, (db - pisoDb) / -pisoDb));
    anterior = Math.max(novo, anterior * suavizacao);
    soma = 0; cont = 0;
    aoNivel(Math.round(anterior * 1000) / 1000);
  }

  return {
    alimentar(bloco) {
      let buf = bloco;
      if (sobra !== null) { buf = Buffer.concat([Buffer.from([sobra]), bloco]); sobra = null; }
      const pares = buf.length >> 1;
      if (buf.length & 1) sobra = buf[buf.length - 1];
      for (let i = 0; i < pares; i++) {
        const v = buf.readInt16LE(i * 2);
        soma += v * v;
        if (++cont >= janela) fechar();
      }
    },
    reiniciar() { soma = 0; cont = 0; sobra = null; anterior = 0; },
  };
}
