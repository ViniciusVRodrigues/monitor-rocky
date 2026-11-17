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
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      video.play().catch(() => {});
    } else if (globalThis.Hls?.isSupported()) {
      hls = new globalThis.Hls({ liveSyncDurationCount: 2, lowLatencyMode: false });
      hls.on(globalThis.Hls.Events.ERROR, (_e, d) => { if (d.fatal) erroVivo(); });
      hls.on(globalThis.Hls.Events.MANIFEST_PARSED, () => { video.play().catch(() => {}); });
      hls.loadSource(url);
      hls.attachMedia(video);
    } else {
      erroVivo();
    }
  }

  function aplicarEstado(novo, acoes) {
    estado = novo;
    if (modo === 'gravacao') return; // o estado muda por baixo; a faixa continua
    mostrarEstadoVivo(acoes);
  }

  function mostrarEstadoVivo(acoes) {
    soltarHls();
    selo.hidden = true;
    if (estado === 'gravando') {
      abrirVivo();
    } else if (estado === 'so-som') {
      mostrarTela('Câmera liberada para você usar. O som continua gravando.', { botao: 'Religar câmera', acao: acoes?.camera, medir: true });
    } else if (estado === 'parado') {
      mostrarTela('Nada está gravando. Câmera e microfone livres.', { botao: 'Voltar a gravar', acao: acoes?.gravar });
    } else {
      mostrarTela('Estado desconhecido. Esperando o monitor…');
    }
  }

  let acoesAtuais = null;

  return {
    /** Recria o player para o estado (a cada evento `estado`). */
    aplicar(novo, acoes) { acoesAtuais = acoes; aplicarEstado(novo, acoes); },

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
