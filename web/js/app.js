// Orquestra a página: configuração, estado (SSE), player, som, controles e linha do tempo.
import { pegarConfig, enviarControle, abrirAoVivo } from './api.js';
import { criarPlayer } from './aovivo.js';
import { criarOuvir, decidirSomAoAbrir, telaSom } from './ouvir.js';
import { criarControles } from './controles.js';
import { criarDia } from './dia.js';
import { criarRecolher } from './recolher.js';

const $ = (id) => document.getElementById(id);

// O vídeo fixo no celular e o scroll até o player ficam logo abaixo do topo (o topo pode quebrar em 2 linhas).
const topo = document.querySelector('.topo');
if (topo) {
  const medirTopo = () => document.documentElement.style.setProperty('--altura-topo', `${topo.offsetHeight}px`);
  medirTopo();
  if (typeof ResizeObserver === 'function') new ResizeObserver(medirTopo).observe(topo);
}

// Em tela larga o vídeo usa a altura que sobra acima dos controles (que podem crescer com a confirmação).
const ctrl = document.querySelector('.controles');
if (ctrl && typeof ResizeObserver === 'function') {
  new ResizeObserver(() => document.documentElement.style.setProperty('--altura-controles', `${ctrl.offsetHeight}px`)).observe(ctrl);
}

const PADRAO = {
  aovivoConectarSegundos: 15, ouvirModo: 'auto', ouvirHz: 24000, ouvirGanhoDb: 18, ouvirFolgaMs: 300, ouvirAtrasoMaxMs: 1000, ouvirMp3AtrasoMaxSegundos: 4,
  linhaTempoAtualizarSegundos: 30, bufferHoras: 4, trechoSegundos: 60, controleTempoLimiteSegundos: 20, somAoAbrir: true,
  guardarMaxArquivos: 120, apagarHoraTrechos: true,
};

const CHIPS = {
  gravando: { texto: 'Gravando', icone: '●', classe: 'chip-gravando' },
  'so-som': { texto: 'Só som · câmera livre', icone: '♪', classe: 'chip-so-som' },
  parado: { texto: 'Parado', icone: '■', classe: 'chip-parado' },
  reiniciando: { texto: 'Reiniciando a captura…', icone: '↻', classe: 'chip-so-som' },
  desconhecido: { texto: 'Estado desconhecido', icone: '?', classe: 'chip-desconhecido' },
};

function lerSalvo() {
  try { return localStorage.getItem('rocky.som'); } catch { return null; }
}
function gravarSalvo(valor) {
  try { localStorage.setItem('rocky.som', valor); } catch { /* sem armazenamento */ }
}

async function carregarConfig() {
  for (;;) {
    try { return { ...PADRAO, ...(await pegarConfig()) }; } catch {
      mostrarOffline(true);
      await new Promise((ok) => setTimeout(ok, 3000));
    }
  }
}

let conectado = null;
let timerVoltou = null;

function mostrarOffline(sem) {
  $('faixa-offline').hidden = !sem;
  $('conexao').textContent = sem ? 'Sem conexão' : 'Conectado';
  $('conexao').dataset.ok = sem ? 'nao' : 'sim';
}

function anunciar(texto) {
  const a = $('anuncio');
  a.textContent = '';
  setTimeout(() => { a.textContent = texto; }, 30);
}

async function principal() {
  const cfg = await carregarConfig();

  let estado = 'desconhecido';
  let reiniciando = false;

  // ---------- chip e nível ----------
  const chip = $('chip');
  function pintarChip() {
    const c = CHIPS[reiniciando ? 'reiniciando' : estado] || CHIPS.desconhecido;
    chip.className = `chip ${c.classe}`;
    chip.dataset.estado = estado;
    chip.querySelector('.chip-icone').textContent = c.icone;
    $('chip-texto').textContent = c.texto;
  }

  const nivelEl = $('nivel');
  const preench = $('nivel-preench');
  let ultimoNivel = 0;
  let nivelValor = 0;
  function pintarNivel() {
    const comDado = (estado === 'gravando' || estado === 'so-som') && Date.now() - ultimoNivel <= 2000;
    nivelEl.dataset.estado = comDado ? 'ativo' : 'sem-som';
    preench.style.transform = `scaleX(${comDado ? nivelValor : 0})`;
  }
  setInterval(pintarNivel, 500);

  // ---------- player ----------
  let somPausadoPorGravacao = false;
  const player = criarPlayer({
    video: $('video'), tela: $('tela'), telaTexto: $('tela-texto'), telaBotao: $('tela-botao'),
    medidor: $('medidor'), selo: $('selo'), faixa: $('faixa-gravacao'), faixaTexto: $('faixa-gravacao-texto'),
    conectarMs: cfg.aovivoConectarSegundos * 1000,
    // Gravação tocando: o som ao vivo do site pausa (senão os dois áudios se misturam) e volta com o ao vivo.
    aoModo: (modo) => {
      if (modo === 'gravacao') {
        somPausadoPorGravacao = ['tocando', 'conectando', 'erro'].includes(ouvir.estado);
        if (somPausadoPorGravacao) ouvir.desligar();
      } else if (somPausadoPorGravacao) {
        somPausadoPorGravacao = false;
        ouvir.ligar();
      }
    },
  });
  $('btn-voltar-vivo').addEventListener('click', () => player.voltarAoVivo());

  // ---------- controles ----------
  const controles = criarControles({
    cfg,
    enviar: enviarControle,
    anunciar,
    extras: [$('tela-botao')],
    aoResultado: ({ estado: novo, ouvindoPC }) => aplicarEstado(novo, ouvindoPC, false, false),
  });
  const acoes = { camera: () => controles.camera(), gravar: () => controles.gravar() };

  function aplicarEstado(novo, ouvindoPC, reinicia, forcar) {
    const mudou = novo !== estado;
    estado = novo;
    reiniciando = Boolean(reinicia);
    pintarChip();
    pintarNivel();
    pintarSom();
    controles.atualizar(estado, ouvindoPC);
    if (mudou || forcar) player.aplicar(estado, acoes);
    if (mudou) anunciar(CHIPS[estado]?.texto ?? '');
  }

  // ---------- som ----------
  const btnOuvir = $('btn-ouvir');
  const mini = $('ouvir-mini');
  let ligouPorGesto = 0;
  let somEst = 'desligado';
  let somTexto = btnOuvir.querySelector('.rotulo').textContent;
  // Em "parado" não há o que ouvir: o botão fica desativado com o motivo, em vez de "Conectando…".
  function pintarSom() {
    const t = telaSom({ parado: estado === 'parado', estado: somEst, texto: somTexto });
    for (const [b, p] of [[btnOuvir, t.grande], [mini, t.mini]]) {
      b.querySelector('.rotulo').textContent = p.rotulo;
      b.disabled = p.desativado;
      b.classList.toggle('ocupado', p.ocupado);
      b.classList.toggle('com-erro', p.comErro);
      b.classList.toggle('silenciado', p.silenciado);
    }
  }
  const ouvir = criarOuvir({
    cfg,
    aoMudar(est, texto) {
      somEst = est;
      somTexto = texto;
      pintarSom();
      if (estado !== 'parado') anunciar(texto);
    },
  });

  function aoClicarSom() {
    // O toque que liberou o som também chega aqui como clique: não desfazer.
    if (Date.now() - ligouPorGesto < 600) return;
    const antes = ouvir.estado;
    somPausadoPorGravacao = false; // a pessoa mexeu no som: a escolha dela vale ao voltar ao vivo
    ouvir.alternar();
    if (antes === 'desligado' || antes === 'falhou' || antes === 'bloqueado') gravarSalvo('ligado');
    else gravarSalvo('silenciado');
  }
  btnOuvir.addEventListener('click', aoClicarSom);
  mini.addEventListener('click', aoClicarSom);

  const liberar = () => {
    if (ouvir.estado !== 'bloqueado') return;
    ligouPorGesto = Date.now();
    somPausadoPorGravacao = false;
    ouvir.ligar();
  };
  document.addEventListener('pointerdown', liberar, true);
  document.addEventListener('keydown', liberar, true);

  if (decidirSomAoAbrir({ somAoAbrir: cfg.somAoAbrir, salvo: lerSalvo() })) ouvir.ligar();

  // Botão compacto no cabeçalho quando o grande sai da tela (só no celular).
  if ('IntersectionObserver' in window) {
    const mq = matchMedia('(max-width: 1023px)');
    new IntersectionObserver(([e]) => { mini.hidden = !(mq.matches && !e.isIntersecting); }, { threshold: 0 }).observe(btnOuvir);
  }

  // ---------- linha do tempo ----------
  const recolher = criarRecolher({
    botao: $('dia-recolher'), painel: $('dia-painel'), raiz: document.documentElement,
    mq: matchMedia('(min-width: 1024px)'),
    armazenamento: {
      ler: () => { try { return localStorage.getItem('rocky.linhaTempo'); } catch { return null; } },
      gravar: (v) => { try { localStorage.setItem('rocky.linhaTempo', v); } catch { /* sem armazenamento */ } },
    },
  });
  const dia = criarDia({
    cfg,
    player,
    anunciar,
    aoTocar: (g) => { player.tocar(g); $('player').scrollIntoView({ block: 'nearest' }); },
  });
  dia.definirOffline(true);
  dia.iniciar();

  // ---------- conexão e SSE ----------
  function aoConexao(ok) {
    if (ok === conectado) return;
    const antes = conectado;
    conectado = ok;
    mostrarOffline(!ok);
    controles.definirOffline(!ok);
    dia.definirOffline(!ok);
    if (!ok) {
      estado = 'desconhecido';
      reiniciando = false;
      pintarChip();
      pintarNivel();
    } else if (antes === false) {
      const v = $('faixa-voltou');
      v.hidden = false;
      clearTimeout(timerVoltou);
      timerVoltou = setTimeout(() => { v.hidden = true; }, 3000);
    }
  }
  controles.definirOffline(true);

  abrirAoVivo({
    aoConexao,
    aoEstado: (d) => aplicarEstado(d.estado, d.ouvindoPC, d.reiniciando, false),
    aoEvento: (ev) => { dia.novoEvento(ev); recolher.eventoNovo(); },
    aoNivel: (n) => {
      ultimoNivel = Date.now();
      nivelValor = Math.min(1, Math.max(0, n));
      pintarNivel();
    },
  });
}

principal();
