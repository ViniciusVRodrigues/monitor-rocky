// Ouvir o som ao vivo. As funções puras (planejarBloco, pcm16ParaFloat32, decidirMp3,
// escolherModo) não tocam no DOM e são testadas em node; o resto só roda no navegador.

/**
 * Decide quando tocar o próximo bloco PCM. Tudo em segundos (relógio do AudioContext).
 * - Se o fluxo já passou do ponto (proximoInicio < agora), recomeça com a folga.
 * - Se o atraso (proximoInicio - agora) passa de atrasoMax, descarta o bloco.
 * Devolve { inicio, descartar, proximo }: `proximo` é o novo proximoInicio.
 */
export function planejarBloco({ agora, proximoInicio, duracao, folga, atrasoMax }) {
  if (!(proximoInicio >= agora)) {
    const inicio = agora + folga;
    return { inicio, descartar: false, proximo: inicio + duracao };
  }
  if (proximoInicio - agora > atrasoMax) {
    return { inicio: proximoInicio, descartar: true, proximo: proximoInicio };
  }
  return { inicio: proximoInicio, descartar: false, proximo: proximoInicio + duracao };
}

/**
 * PCM s16le mono (Uint8Array) → Float32Array. Se `sobra` (byte pendente do bloco anterior)
 * existir, ele vem na frente; se o total for ímpar, o último byte é guardado de novo.
 * Devolve { amostras, sobra } (sobra: número 0..255 ou null).
 */
export function pcm16ParaFloat32(bytes, sobra = null) {
  let dados = bytes;
  if (sobra !== null && sobra !== undefined) {
    dados = new Uint8Array(bytes.length + 1);
    dados[0] = sobra;
    dados.set(bytes, 1);
  }
  const pares = dados.length >> 1;
  const novaSobra = dados.length & 1 ? dados[dados.length - 1] : null;
  const amostras = new Float32Array(pares);
  const vista = new DataView(dados.buffer, dados.byteOffset, dados.byteLength);
  for (let i = 0; i < pares; i++) amostras[i] = vista.getInt16(i * 2, true) / 32768;
  return { amostras, sobra: novaSobra };
}

/** Atraso do MP3: 'nada' | 'saltar' | 'recarregar' (já saltou e continua atrasado). */
export function decidirMp3({ atraso, max, saltouAntes }) {
  if (!(atraso > max)) return 'nada';
  return saltouAntes ? 'recarregar' : 'saltar';
}

/** Modo efetivo: 'auto' usa mp3 em tela de toque e pcm no resto. */
export function escolherModo(ouvirModo, toque) {
  if (ouvirModo === 'pcm' || ouvirModo === 'mp3') return ouvirModo;
  return toque ? 'mp3' : 'pcm';
}

/**
 * Decide se o som toca ao abrir: a escolha salva no aparelho ("ligado" | "silenciado")
 * vale mais que `somAoAbrir` da configuração.
 */
export function decidirSomAoAbrir({ somAoAbrir, salvo }) {
  if (salvo === 'ligado') return true;
  if (salvo === 'silenciado') return false;
  return somAoAbrir !== false;
}

/** dB → fator linear de amplitude. Valor ausente ou inválido = sem ganho (1). */
export function ganhoLinear(db) {
  const n = typeof db === 'number' ? db : Number.NaN;
  return Number.isFinite(n) ? 10 ** (n / 20) : 1;
}

/**
 * Liga a origem à saída por GainNode (`ouvirGanhoDb`) e DynamicsCompressor, que segura um
 * latido alto depois do ganho para não estourar. Devolve o nó de ganho.
 */
export function montarCadeia(ctx, origem, cfg) {
  const ganho = ctx.createGain();
  ganho.gain.value = ganhoLinear(cfg.ouvirGanhoDb);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = cfg.ouvirCompLimiarDb ?? -18;
  comp.knee.value = cfg.ouvirCompJoelhoDb ?? 12;
  comp.ratio.value = cfg.ouvirCompRazao ?? 12;
  comp.attack.value = 0.003;
  comp.release.value = 0.25;
  origem.connect(ganho);
  ganho.connect(comp);
  comp.connect(ctx.destination);
  return ganho;
}

const TEXTOS = {
  desligado: 'Ativar som',
  bloqueado: 'Toque para ouvir o Rocky', // o único aviso quando o navegador bloqueia o som
  conectando: 'Conectando…',
  tocando: 'Silenciar',
  erro: 'Sem som. Reconectando…',
  falhou: 'Não deu para ouvir. Tentar de novo',
};
/**
 * Como pintar o botão grande e o mini do cabeçalho. `parado`: o monitor não grava (nada a ouvir).
 * No bloqueio o aviso é o botão grande; o mini (só aparece com o grande fora da tela) diz "Ativar som".
 */
export function telaSom({ parado, estado, texto }) {
  const botao = (rotulo) => ({
    rotulo: parado ? 'Sem som · nada gravando' : rotulo,
    desativado: Boolean(parado),
    ocupado: !parado && estado === 'conectando',
    comErro: !parado && (estado === 'erro' || estado === 'falhou'),
    silenciado: Boolean(parado) || estado === 'desligado' || estado === 'bloqueado',
  });
  return { grande: botao(texto), mini: botao(estado === 'bloqueado' ? 'Ativar som' : texto) };
}

const MAX_FALHAS = 3;
const ESPERA_RECONECTAR_MS = 1500;

/**
 * Controlador do botão Ouvir. `aoMudar(estado, texto)` avisa a tela (botão, espelho no
 * cabeçalho, região viva). Estados: desligado (silenciado), bloqueado (o navegador não deixou tocar sem toque), conectando, tocando, erro, falhou.
 */
export function criarOuvir({ cfg, aoMudar }) {
  const toque = Boolean(globalThis.matchMedia?.('(pointer: coarse)').matches);
  const modo = escolherModo(cfg.ouvirModo, toque);
  let estado = 'desligado';
  let falhas = 0;
  let sessao = 0; // muda a cada liga/desliga, para ignorar retornos de sessões antigas
  let parte = null;
  let timerReconectar = null;

  const mudar = (novo) => {
    if (novo === estado) return;
    estado = novo;
    aoMudar(estado, TEXTOS[estado]);
  };

  function falhar(minhaSessao) {
    if (minhaSessao !== sessao) return;
    parte?.parar();
    parte = null;
    falhas += 1;
    if (falhas >= MAX_FALHAS) { mudar('falhou'); return; }
    mudar('erro');
    timerReconectar = setTimeout(() => { if (minhaSessao === sessao) iniciarParte(minhaSessao); }, ESPERA_RECONECTAR_MS);
  }

  function iniciarParte(minhaSessao) {
    const ganchos = {
      tocou: () => { if (minhaSessao === sessao) { falhas = 0; mudar('tocando'); } },
      falhou: () => falhar(minhaSessao),
      bloqueado: () => {
        if (minhaSessao !== sessao) return;
        parte?.parar();
        parte = null;
        mudar('bloqueado');
      },
    };
    parte = modo === 'mp3' ? ouvirMp3(cfg, ganchos) : ouvirPcm(cfg, ganchos);
  }

  function ligar() {
    sessao += 1;
    clearTimeout(timerReconectar);
    parte?.parar(); // nunca deixa duas partes ativas (som duplicado)
    parte = null;
    falhas = 0;
    mudar('conectando');
    // Roda dentro do clique: cria o AudioContext / o <audio> e chama play() já.
    iniciarParte(sessao);
  }

  function desligar() {
    sessao += 1;
    clearTimeout(timerReconectar);
    parte?.parar();
    parte = null;
    mudar('desligado');
  }

  return {
    modo,
    get estado() { return estado; },
    ligar,
    alternar() { if (estado === 'desligado' || estado === 'falhou' || estado === 'bloqueado') ligar(); else desligar(); },
    desligar,
  };
}

function ouvirPcm(cfg, ganchos) {
  const Contexto = globalThis.AudioContext || globalThis.webkitAudioContext;
  const ctx = new Contexto();
  const abort = new AbortController();
  const folga = cfg.ouvirFolgaMs / 1000;
  const atrasoMax = cfg.ouvirAtrasoMaxMs / 1000;
  let parou = false;
  let proximo = 0;
  let sobra = null;
  const entrada = ctx.createGain(); // ponto único de entrada dos blocos
  montarCadeia(ctx, entrada, cfg);

  (async () => {
    try {
      // Sem gesto da pessoa o navegador deixa o contexto suspenso: é o bloqueio.
      await Promise.race([ctx.resume?.(), new Promise((ok) => setTimeout(ok, 400))]);
      if (parou) return;
      if (ctx.state !== 'running') { ganchos.bloqueado(); return; }
      const resposta = await fetch('/api/ouvir/pcm', { signal: abort.signal, cache: 'no-store' });
      if (!resposta.ok || !resposta.body) throw new Error(`HTTP ${resposta.status}`);
      const taxa = Number(resposta.headers.get('X-Taxa')) || cfg.ouvirHz;
      const leitor = resposta.body.getReader();
      for (;;) {
        const { value, done } = await leitor.read();
        if (done) throw new Error('fluxo encerrado');
        if (!value?.length) continue;
        const r = pcm16ParaFloat32(value, sobra);
        sobra = r.sobra;
        if (!r.amostras.length) continue;
        const buffer = ctx.createBuffer(1, r.amostras.length, taxa);
        buffer.copyToChannel(r.amostras, 0);
        const plano = planejarBloco({ agora: ctx.currentTime, proximoInicio: proximo, duracao: buffer.duration, folga, atrasoMax });
        proximo = plano.proximo;
        if (plano.descartar) continue;
        const fonte = ctx.createBufferSource();
        fonte.buffer = buffer;
        fonte.connect(entrada);
        fonte.start(plano.inicio);
        ganchos.tocou();
      }
    } catch {
      if (!parou) ganchos.falhou();
    }
  })();

  return {
    parar() {
      parou = true;
      abort.abort();
      ctx.close?.().catch(() => {});
    },
  };
}

function ouvirMp3(cfg, ganchos) {
  const audio = new Audio();
  audio.preload = 'none';
  audio.src = '/api/ouvir/mp3';
  let parou = false;
  let ctx = null;
  // O ganho passa por um AudioContext criado no clique; sem ele o <audio> toca sem ganho.
  try {
    const Contexto = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (Contexto) {
      ctx = new Contexto();
      montarCadeia(ctx, ctx.createMediaElementSource(audio), cfg);
      ctx.resume?.().catch(() => {});
    }
  } catch { ctx = null; }
  let saltou = false;

  audio.addEventListener('playing', ganchos.tocou);
  audio.addEventListener('error', () => { if (!parou) ganchos.falhou(); });
  audio.addEventListener('ended', () => { if (!parou) ganchos.falhou(); });
  audio.play()?.catch((erro) => {
    if (parou) return;
    if (erro?.name === 'NotAllowedError') ganchos.bloqueado(); else ganchos.falhou();
  });

  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: 'Rocky · ao vivo', artist: 'Monitor do Rocky' });
      navigator.mediaSession.setActionHandler('pause', () => { audio.pause(); });
      navigator.mediaSession.setActionHandler('play', () => { audio.play().catch(() => {}); });
    } catch { /* sem Media Session completa */ }
  }

  const vigia = setInterval(() => {
    const b = audio.buffered;
    if (!b.length) return;
    const fim = b.end(b.length - 1);
    const acao = decidirMp3({ atraso: fim - audio.currentTime, max: cfg.ouvirMp3AtrasoMaxSegundos, saltouAntes: saltou });
    if (acao === 'saltar') {
      audio.currentTime = Math.max(0, fim - 0.5);
      saltou = true;
    } else if (acao === 'recarregar') {
      saltou = false;
      audio.src = '/api/ouvir/mp3';
      audio.play().catch(() => {});
    } else {
      saltou = false;
    }
  }, 2000);

  return {
    parar() {
      parou = true;
      clearInterval(vigia);
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      ctx?.close?.().catch(() => {});
      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.metadata = null;
          navigator.mediaSession.setActionHandler('pause', null);
          navigator.mediaSession.setActionHandler('play', null);
        } catch { /* nada */ }
      }
    },
  };
}
