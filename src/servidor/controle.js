const ACOES = ['gravar', 'parar', 'camera-desligar', 'camera-ligar', 'ouvir-pc-ligar', 'ouvir-pc-desligar'];

export class ControleErro extends Error {
  constructor(status, mensagem) { super(mensagem); this.status = status; }
}

export const estadoAtual = (monitor) => ({ estado: monitor.gravador.estado(), ouvindoPC: monitor.ouvinte.ativo() });

/**
 * Executa uma ação de controle no monitor. Lança ControleErro (400, 409, 504)
 * ou um Error comum (vira 500). Devolve { estado, ouvindoPC }.
 */
export async function executarControle(monitor, acao, tempoLimiteMs) {
  if (!ACOES.includes(acao)) throw new ControleErro(400, 'Ação desconhecida.');
  const { gravador, ouvinte } = monitor;
  if ((acao === 'camera-ligar' || acao === 'camera-desligar') && gravador.estado() === 'parado') {
    throw new ControleErro(409, 'A captura está parada; use Voltar a gravar primeiro.');
  }
  const trabalho = (async () => {
    switch (acao) {
      case 'gravar': await gravador.iniciar(); break;
      case 'parar': await gravador.parar(); break;
      case 'camera-desligar': await gravador.camera('desligar'); break;
      case 'camera-ligar': await gravador.camera('ligar'); break;
      case 'ouvir-pc-ligar': ouvinte.ligar(); break;
      case 'ouvir-pc-desligar': await ouvinte.desligar(); break;
    }
  })();
  trabalho.catch(() => {}); // o erro tardio, depois do tempo limite, não derruba o processo
  let timer;
  const limite = new Promise((_, rej) => {
    timer = setTimeout(() => rej(new ControleErro(504, 'O monitor não respondeu a tempo.')), tempoLimiteMs);
  });
  try { await Promise.race([trabalho, limite]); } finally { clearTimeout(timer); }
  return estadoAtual(monitor);
}
