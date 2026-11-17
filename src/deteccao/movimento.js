// Detector de movimento por diferença entre quadros em tons de cinza.

const par = (v) => Math.max(2, 2 * Math.round(v / 2));

/** Tamanho de análise ('1280x720', 160) mantendo a proporção, ambos pares. */
export function tamanhoAnalise(resolucao, largura) {
  const [w, h] = String(resolucao).split('x').map(Number);
  const l = par(largura);
  return { largura: l, altura: par((l * h) / w) };
}

/** Fração (0..1) de pixels com |a[i]-b[i]| > limiarPixel. */
export function fracaoMudada(a, b, limiarPixel) {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let mudados = 0;
  for (let i = 0; i < n; i++) {
    const d = a[i] - b[i];
    if (d > limiarPixel || -d > limiarPixel) mudados++;
  }
  return mudados / n;
}

/**
 * @param {object} o
 * @param {number} o.largura
 * @param {number} o.altura
 * @param {number} o.limiarPixel      diferença mínima (0..255) para o pixel contar
 * @param {number} o.areaMinima       fração mínima de pixels mudados
 * @param {number} o.quadrosSeguidos  quadros seguidos acima da área para valer
 * @param {(t:number, fracao:number)=>void} o.aoAtividade
 */
export function criarDetectorMovimento({ largura, altura, limiarPixel, areaMinima, quadrosSeguidos, aoAtividade }) {
  const tamanho = largura * altura;
  let atual = new Uint8Array(tamanho);
  let anterior = new Uint8Array(tamanho);
  let preenchido = 0;
  let temAnterior = false;
  let seguidos = 0;

  function reiniciar() {
    preenchido = 0;
    temAnterior = false;
    seguidos = 0;
  }

  function quadroCompleto(agoraMs) {
    if (temAnterior) {
      const f = fracaoMudada(atual, anterior, limiarPixel);
      if (f >= areaMinima) {
        seguidos++;
        if (seguidos >= quadrosSeguidos) {
          try {
            aoAtividade(agoraMs, f);
          } catch {
            // o detector nunca quebra por erro de quem ouve
          }
        }
      } else {
        seguidos = 0;
      }
    }
    const t = anterior;
    anterior = atual;
    atual = t;
    temAnterior = true;
    preenchido = 0;
  }

  function processar(bloco, agoraMs) {
    let pos = 0;
    while (pos < bloco.length) {
      const n = Math.min(tamanho - preenchido, bloco.length - pos);
      atual.set(bloco.subarray(pos, pos + n), preenchido);
      preenchido += n;
      pos += n;
      if (preenchido === tamanho) quadroCompleto(agoraMs);
    }
  }

  return { processar, reiniciar };
}
