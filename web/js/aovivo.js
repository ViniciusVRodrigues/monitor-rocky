// Player único: ao vivo (HLS) e gravações no mesmo <video>.

const REPETIR_MS = 5000;

export function criarPlayer({ video, tela, telaTexto, telaBotao, medidor, selo, faixa, faixaTexto, conectarMs = 15000, aoModo = () => {} }) {
  let hls = null;
  let estado = 'desconhecido';
  let modo = 'vivo'; // 'vivo' | 'gravacao'
  let timerRepetir = null;
  let timerConectar = null;
  let gravacao = null; // { urls, i, soAudio, rotulo }
  let acaoTela = null;

  telaBotao.addEventListener('click', () => acaoTela?.());

  function mostrarTela(texto, { botao = null, acao = null, medir = false } = {}) {
    tela.hidden = false;
    telaTexto.textContent = texto;
    medidor.hidden = !medir;
    telaBotao.hidden = !botao;
    if (botao) telaBotao.textContent = botao;
    acaoTela = acao;
  }
  const esconderTela = () => { tela.hidden = true; acaoTela = null; };

  function soltarHls() {
    clearTimeout(timerRepetir);
    clearTimeout(timerConectar);
    video.onplaying = null;
    video.onerror = null;
    video.onended = null;
    if (hls) { hls.destroy(); hls = null; }
    video.removeAttribute('src');
    video.load();
  }

  function erroVivo() {
    mostrarTela('Não consegui abrir o ao vivo. Tentando de novo…', { botao: 'Tentar agora', acao: abrirVivo });
    selo.hidden = true;
    clearTimeout(timerRepetir);
    timerRepetir = setTimeout(() => { if (modo === 'vivo' && estado === 'gravando') abrirVivo(); }, REPETIR_MS);
  }

  function abrirVivo() {
    soltarHls();
    video.muted = true;
    video.controls = false;
    mostrarTela('Conectando ao ao vivo…');
    video.hidden = false;
    const url = `/aovivo/index.m3u8?t=${Date.now()}`;
    const aoTocar = () => {
      if (modo !== 'vivo') return;
      clearTimeout(timerConectar);
      esconderTela();
      selo.hidden = false;
    };
    // Sem isto, um HLS que nunca toca nem dá erro deixaria "Conectando…" para sempre.
    timerConectar = setTimeout(() => { if (modo === 'vivo' && estado === 'gravando') erroVivo(); }, conectarMs);
    video.onplaying = aoTocar;
    video.onerror = erroVivo;
    const Hls = globalThis.Hls;
    // hls.js primeiro (o Chrome diz "maybe" ao HLS nativo, mas trava em ~6 s); nativo só sem MSE (iOS).
    if (Hls?.isSupported()) {
      let recuperou = false;
      hls = new Hls({ liveSyncDurationCount: 3, lowLatencyMode: false });
      hls.on(Hls.Events.ERROR, (_e, d) => {
        if (!d.fatal) return;
        if (d.type === Hls.ErrorTypes.MEDIA_ERROR && !recuperou) {
          recuperou = true;
          hls.recoverMediaError();
          return;
        }
        erroVivo();
      });
      hls.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(() => {}); });
      hls.loadSource(url);
      hls.attachMedia(video);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      video.play().catch(() => {});
    } else {
      erroVivo();
    }
  }

  function aplicarEstado(novo, acoes, forcar) {
    const igual = novo === estado;
    estado = novo;
    if (modo === 'gravacao') return; // o estado muda por baixo; a faixa continua
    if (igual && !forcar) return; // mesmo estado (SSE reconectando, batida): o player não é mexido
    mostrarEstadoVivo(acoes);
  }

  function mostrarEstadoVivo(acoes) {
    soltarHls();
    selo.hidden = true;
    if (estado === 'gravando') {
      abrirVivo();
    } else if (estado === 'so-som') {
      mostrarTela('Câmera liberada para você usar. O som continua gravando.', { botao: 'Religar câmera', acao: () => acoesAtuais?.camera?.(), medir: true });
    } else if (estado === 'parado') {
      mostrarTela('Nada está gravando. Câmera e microfone livres.', { botao: 'Voltar a gravar', acao: () => acoesAtuais?.gravar?.() });
    } else {
      mostrarTela('Estado desconhecido. Esperando o monitor…');
    }
  }

  let acoesAtuais = null;

  return {
    /** Recria o player só se o estado mudou (ou `forcar`, para pedido da pessoa); senão só atualiza as ações. */
    aplicar(novo, acoes, { forcar = false } = {}) { acoesAtuais = acoes; aplicarEstado(novo, acoes, forcar); },

    /** Toca uma gravação: { urls: [...], soAudio, rotulo } — emenda as urls em sequência. */
    tocar({ urls, soAudio, rotulo }) {
      soltarHls();
      if (modo !== 'gravacao') aoModo('gravacao');
      modo = 'gravacao';
      gravacao = { urls, i: 0, soAudio, rotulo };
      selo.hidden = true;
      faixa.hidden = false;
      faixaTexto.textContent = `Gravação · ${rotulo}${soAudio ? ' · só som' : ''}`;
      video.hidden = false;
      video.muted = false;
      video.controls = true;
      video.onplaying = null;
      video.onerror = () => mostrarTela('Não consegui abrir esta gravação.', { botao: 'Voltar ao ao vivo', acao: () => this.voltarAoVivo() });
      esconderTela();
      if (soAudio) mostrarTela('Só som', { medir: true });
      const tocarAtual = () => {
        video.src = gravacao.urls[gravacao.i];
        video.play().catch(() => {});
      };
      video.onended = () => {
        if (gravacao && gravacao.i + 1 < gravacao.urls.length) { gravacao.i += 1; tocarAtual(); }
      };
      tocarAtual();
    },

    voltarAoVivo() {
      if (modo !== 'vivo') aoModo('vivo');
      modo = 'vivo';
      gravacao = null;
      faixa.hidden = true;
      video.onended = null;
      video.controls = false;
      esconderTela();
      mostrarEstadoVivo(acoesAtuais);
    },

    get modo() { return modo; },
  };
}
