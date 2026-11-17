// Controles da captura: Liberar/Religar câmera, Ouvir no PC, Parar/Voltar a gravar.

const CONFIRMA_MS = 6000;

function definirRotulo(botao, texto) {
  const r = botao.querySelector('.rotulo');
  if (r) r.textContent = texto;
  else botao.textContent = texto;
}

export function criarControles({ cfg, enviar, aoResultado, anunciar, extras = [] }) {
  const $ = (id) => document.getElementById(id);
  const btnCamera = $('btn-camera');
  const btnPc = $('btn-ouvirpc');
  const btnGrav = $('btn-gravacao');
  const confirma = $('confirma-parar');
  const btnSim = $('btn-sim-parar');
  const btnCancelar = $('btn-cancelar-parar');
  const subPc = $('sub-ouvirpc');
  const aviso = $('aviso-controle');
  const avisoTexto = $('aviso-controle-texto');
  const btnTentar = $('btn-tentar-controle');
  const avisoOffline = $('aviso-offline');

  let estado = 'desconhecido';
  let ouvindoPC = false;
  let ocupado = null; // botão que está aplicando
  let offline = true;
  let ultimaAcao = null;
  let timerConfirma = null;

  // Botões que o plano manda desativar durante um pedido (os três mais os do overlay).
  const todos = () => [btnCamera, btnPc, btnGrav, ...extras];

  function pintar() {
    const sem = offline;
    const parado = estado === 'parado';
    if (!ocupado) {
      definirRotulo(btnCamera, estado === 'so-som' ? 'Religar câmera' : 'Liberar câmera');
      definirRotulo(btnGrav, parado ? 'Voltar a gravar' : 'Parar');
      definirRotulo(btnPc, 'Ouvir no PC');
      btnGrav.classList.toggle('botao-perigo', !parado);
      btnGrav.classList.toggle('botao-principal', parado);
    }
    btnPc.setAttribute('aria-pressed', String(ouvindoPC));
    subPc.textContent = ouvindoPC ? 'tocando no PC' : '';
    for (const b of todos()) {
      const desativar = sem || (ocupado && b !== ocupado) || (b === btnCamera && (parado || estado === 'desconhecido'));
      b.disabled = Boolean(desativar);
    }
    avisoOffline.hidden = !sem;
  }

  function limparAviso() { aviso.hidden = true; }

  async function executar(acao, origem) {
    if (ocupado || offline) return;
    ultimaAcao = { acao, origem };
    limparAviso();
    ocupado = origem;
    // Retorno imediato (síncrono, bem antes de 100 ms).
    const antes = origem.querySelector?.('.rotulo')?.textContent ?? origem.textContent;
    definirRotulo(origem, 'Aplicando…');
    origem.setAttribute('aria-busy', 'true');
    origem.classList.add('ocupado');
    pintar();
    anunciar('Aplicando…');
    const r = await enviar(acao, cfg.controleTempoLimiteSegundos);
    ocupado = null;
    origem.removeAttribute('aria-busy');
    origem.classList.remove('ocupado');
    definirRotulo(origem, antes);
    if (r.ok) {
      if (r.estado) estado = r.estado;
      if (typeof r.ouvindoPC === 'boolean') ouvindoPC = r.ouvindoPC;
      aoResultado({ estado, ouvindoPC });
      anunciar('Aplicado.');
    } else {
      avisoTexto.textContent = `Não deu certo: ${String(r.erro).replace(/\.$/, '')}.`;
      aviso.hidden = false;
    }
    pintar();
  }

  const acaoCamera = () => (estado === 'so-som' ? 'camera-ligar' : 'camera-desligar');

  function fecharConfirma(devolverFoco) {
    clearTimeout(timerConfirma);
    if (confirma.hidden) return;
    confirma.hidden = true;
    btnGrav.hidden = false;
    if (devolverFoco) btnGrav.focus();
  }

  function abrirConfirma() {
    btnGrav.hidden = true;
    confirma.hidden = false;
    btnCancelar.focus();
    clearTimeout(timerConfirma);
    timerConfirma = setTimeout(() => fecharConfirma(false), CONFIRMA_MS);
  }

  btnCamera.addEventListener('click', () => executar(acaoCamera(), btnCamera));
  btnPc.addEventListener('click', () => executar(ouvindoPC ? 'ouvir-pc-desligar' : 'ouvir-pc-ligar', btnPc));
  btnGrav.addEventListener('click', () => {
    if (estado === 'parado') executar('gravar', btnGrav);
    else abrirConfirma();
  });
  btnSim.addEventListener('click', () => { fecharConfirma(false); executar('parar', btnGrav); });
  btnCancelar.addEventListener('click', () => fecharConfirma(true));
  confirma.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); fecharConfirma(true); } });
  btnTentar.addEventListener('click', () => { if (ultimaAcao) executar(ultimaAcao.acao, ultimaAcao.origem); });

  return {
    executar,
    /** Estado confirmado pelo servidor (SSE ou resposta). */
    atualizar(novoEstado, novoOuvindoPC) {
      estado = novoEstado;
      if (typeof novoOuvindoPC === 'boolean') ouvindoPC = novoOuvindoPC;
      if (estado === 'parado') fecharConfirma(false);
      pintar();
    },
    definirOffline(valor) {
      offline = valor;
      if (offline) fecharConfirma(false);
      pintar();
    },
    camera: () => executar(acaoCamera(), btnCamera),
    gravar: () => executar('gravar', btnGrav),
    pintar,
  };
}
