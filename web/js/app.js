// Orquestra a página: configuração, estado (SSE), player, som, controles e linha do tempo.
import { pegarConfig, enviarControle, abrirAoVivo } from './api.js';
import { criarPlayer } from './aovivo.js';
import { criarOuvir, decidirSomAoAbrir } from './ouvir.js';
import { criarControles } from './controles.js';
import { criarDia } from './dia.js';

const $ = (id) => document.getElementById(id);

const PADRAO = {
  ouvirModo: 'auto', ouvirHz: 16000, ouvirFolgaMs: 300, ouvirAtrasoMaxMs: 1000, ouvirMp3AtrasoMaxSegundos: 4,
  linhaTempoAtualizarSegundos: 30, bufferHoras: 4, trechoSegundos: 60, controleTempoLimiteSegundos: 20, somAoAbrir: true,
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
  const player = criarPlayer({
    video: $('video'), tela: $('tela'), telaTexto: $('tela-texto'), telaBotao: $('tela-botao'),
    medidor: $('medidor'), selo: $('selo'), faixa: $('faixa-gravacao'), faixaTexto: $('faixa-gravacao-texto'),
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
  const toque = $('toque-ouvir');
  let ligouPorGesto = 0;
  let somEst = 'desligado';
  let somTexto = btnOuvir.querySelector('.rotulo').textContent;
  // Em "parado" não há o que ouvir: o botão fica desativado com o motivo, em vez de "Conectando…".
  function pintarSom() {
    const parado = estado === 'parado';
    for (const b of [btnOuvir, mini]) {
      b.querySelector('.rotulo').textContent = parado ? 'Sem som · nada gravando' : somTexto;
      b.disabled = parado;
      b.classList.toggle('ocupado', !parado && somEst === 'conectando');
      b.classList.toggle('com-erro', !parado && (somEst === 'erro' || somEst === 'falhou'));
      b.classList.toggle('silenciado', parado || somEst === 'desligado' || somEst === 'bloqueado');
    }
    toque.hidden = parado || somEst !== 'bloqueado';
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
    ouvir.alternar();
    if (antes === 'desligado' || antes === 'falhou' || antes === 'bloqueado') gravarSalvo('ligado');
    else gravarSalvo('silenciado');
  }
  btnOuvir.addEventListener('click', aoClicarSom);
  mini.addEventListener('click', aoClicarSom);
  toque.addEventListener('click', () => { if (Date.now() - ligouPorGesto >= 600 && ouvir.estado === 'bloqueado') ouvir.ligar(); });

  const liberar = () => {
    if (ouvir.estado !== 'bloqueado') return;
    ligouPorGesto = Date.now();
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
  const dia = criarDia({
    cfg,
    aoTocar: (g) => { player.tocar(g); $('player').scrollIntoView({ block: 'nearest' }); },
  });
  dia.iniciar();

  // ---------- conexão e SSE ----------
  function aoConexao(ok) {
    if (ok === conectado) return;
    const antes = conectado;
    conectado = ok;
    mostrarOffline(!ok);
    controles.definirOffline(!ok);
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
    aoEstado: (d) => aplicarEstado(d.estado, d.ouvindoPC, d.reiniciando, true),
    aoEvento: (ev) => dia.novoEvento(ev),
    aoNivel: (n) => {
      ultimoNivel = Date.now();
      nivelValor = Math.min(1, Math.max(0, n));
      pintarNivel();
    },
  });
}

principal();
