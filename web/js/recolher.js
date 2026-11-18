// Linha do tempo recolhível num trilho à direita (só em tela larga). A escolha fica no aparelho.

/** Texto do botão: aberto mostra a ação; recolhido mostra o nome e os eventos que chegaram. */
export function textoTrilho({ recolhida, novos }) {
  if (!recolhida) return 'Recolher linha do tempo';
  if (!novos) return 'Linha do tempo';
  return `Linha do tempo · ${novos} ${novos === 1 ? 'evento novo' : 'eventos novos'}`;
}

/**
 * `botao`: o trilho (com `.rotulo`); `painel`: o conteúdo da linha do tempo; `raiz`: recebe a
 * classe `dia-recolhida` (o CSS dá a largura ao vídeo); `mq`: matchMedia da tela larga;
 * `armazenamento`: { ler(), gravar(v) } com 'recolhida' | 'aberta'.
 */
export function criarRecolher({ botao, painel, raiz, mq, armazenamento }) {
  let escolha = armazenamento.ler() === 'recolhida';
  let novos = 0;
  const rotulo = botao.querySelector('.rotulo') ?? botao;

  function pintar() {
    const recolhida = escolha && mq.matches;
    painel.hidden = recolhida;
    raiz.classList.toggle('dia-recolhida', recolhida);
    botao.setAttribute('aria-expanded', String(!recolhida));
    rotulo.textContent = textoTrilho({ recolhida, novos });
  }

  botao.addEventListener('click', () => {
    escolha = !escolha;
    novos = 0;
    armazenamento.gravar(escolha ? 'recolhida' : 'aberta');
    pintar();
  });
  mq.addEventListener?.('change', pintar);
  pintar();

  return {
    get recolhida() { return escolha && mq.matches; },
    eventoNovo() {
      if (!(escolha && mq.matches)) return;
      novos += 1;
      pintar();
    },
  };
}
