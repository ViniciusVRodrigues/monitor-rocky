// Detector de som por energia: RMS em dBFS por janela, com duração mínima.

/**
 * @param {object} o
 * @param {number} o.hz              taxa do PCM s16le mono
 * @param {number} o.limiarDb        janela acima disso é "alta"
 * @param {number} o.janelaMs        tamanho da janela de análise
 * @param {number} o.duracaoMinimaMs soma mínima de janelas altas seguidas para valer
 * @param {(t:number, intensidade:number)=>void} o.aoAtividade
 */
export function criarDetectorSom({ hz, limiarDb, janelaMs, duracaoMinimaMs, aoAtividade }) {
  const amostrasJanela = Math.max(1, Math.round((hz * janelaMs) / 1000));
  const duracaoJanela = (amostrasJanela / hz) * 1000;
  let sobra = null; // byte ímpar de um bloco anterior
  let soma = 0; // soma dos quadrados da janela em andamento
  let n = 0; // amostras acumuladas na janela em andamento
  let seqMs = 0; // duração acumulada de janelas altas seguidas
  let seqInicio = 0;
  let seqIntensidade = 0;
  let valida = false;

  function chamar(t, intensidade) {
    try {
      aoAtividade(t, intensidade);
    } catch {
      // o detector nunca quebra por erro de quem ouve
    }
  }

  function fecharJanela(tFim) {
    const rms = Math.sqrt(soma / n);
    soma = 0;
    n = 0;
    const db = rms === 0 ? -Infinity : 20 * Math.log10(rms / 32768);
    if (!(db > limiarDb)) {
      seqMs = 0;
      valida = false;
      return;
    }
    const intensidade = Math.min(1, Math.max(0, (db - limiarDb) / (0 - limiarDb)));
    if (seqMs === 0) {
      seqInicio = tFim - duracaoJanela;
      seqIntensidade = 0;
    }
    seqMs += duracaoJanela;
    seqIntensidade = Math.max(seqIntensidade, intensidade);
    if (valida) {
      chamar(tFim, intensidade);
    } else if (seqMs >= duracaoMinimaMs) {
      valida = true;
      chamar(seqInicio, seqIntensidade);
      chamar(tFim, intensidade); // o evento já cobre até o fim desta janela
    }
  }

  function processar(bloco, agoraMs) {
    let dados = bloco;
    if (sobra) {
      dados = Buffer.concat([sobra, bloco]);
      sobra = null;
    }
    const total = dados.length >> 1;
    if (dados.length & 1) sobra = Buffer.from(dados.subarray(dados.length - 1));
    for (let i = 0; i < total; i++) {
      const v = dados.readInt16LE(i * 2);
      soma += v * v;
      n++;
      if (n === amostrasJanela) {
        // instante do fim desta amostra: agoraMs menos o que veio depois dela no bloco
        fecharJanela(agoraMs - ((total - 1 - i) / hz) * 1000);
      }
    }
  }

  return { processar };
}
