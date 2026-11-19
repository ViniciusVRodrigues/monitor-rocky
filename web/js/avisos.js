// Bloco "Avisos no celular": registra o service worker, pede permissão e inscreve o aparelho no push.
import { pegarJson, postarJson } from './api.js';
import { estadoAvisos, ehIos, versaoIos, iosAntigo, textoRegra, base64urlParaBytes, chavesIguais } from './avisos-estado.js';

const ROTULOS = {
  verificando: 'Verificando…',
  indisponivel: 'Indisponível aqui',
  'sem-suporte': 'Sem suporte',
  instalar: 'Falta instalar',
  pronto: 'Desligados',
  bloqueado: 'Bloqueados',
  ativo: '✓ Ligados neste aparelho',
  'desligado-pc': 'Desligados no PC',
};
const NOTA_TAILSCALE = 'O aviso chega mesmo com o Tailscale desligado; para abrir a página ao tocar nele, ligue o Tailscale.';
const MSG_ERRO = 'Não deu para ativar os avisos. Confira a internet e tente de novo.';
const MSG_TESTE_OK = 'Aviso de teste enviado. Deve chegar em alguns segundos.';
const MSG_TESTE_ERRO = 'Não deu para enviar o aviso de teste. Tente de novo.';
const CHAVE_SALVA = 'rocky.avisos';

function el(tag, attrs = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === 'class') e.className = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const f of filhos) if (f != null) e.append(f);
  return e;
}

const ler = () => { try { return localStorage.getItem(CHAVE_SALVA); } catch { return null; } };
const gravar = () => { try { localStorage.setItem(CHAVE_SALVA, 'ativado'); } catch { /* sem armazenamento */ } };
const esperar = (promessa, ms) => Promise.race([promessa, new Promise((_, no) => setTimeout(() => no(new Error('tempo esgotado')), ms))]);

export function iniciarAvisos({ cfg, anunciar = () => {} }) {
  const det = document.getElementById('avisos-det');
  const corpo = document.getElementById('avisos-corpo');
  const resumo = document.getElementById('avisos-texto');
  if (!det || !corpo || !resumo) return;

  const ua = navigator.userAgent || '';
  const ios = ehIos({ userAgent: ua, platform: navigator.platform, maxTouchPoints: navigator.maxTouchPoints });
  const iosVersao = versaoIos(ua);
  const seguro = Boolean(window.isSecureContext);
  const standalone = Boolean(window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone);
  const temSw = 'serviceWorker' in navigator;
  const temPush = temSw && 'PushManager' in window && 'Notification' in window;
  const avisosLigados = cfg.avisos !== false;
  const permissaoAtual = () => (typeof Notification === 'undefined' ? 'default' : Notification.permission);

  const vista = { verificando: true, inscrito: false, pedindo: false, erro: false, nota: '', teste: '', testando: false, foco: null };
  let chaveServidor = null;
  let ultimoEstado = null;

  if (ler() === 'ativado') det.open = false;

  function estado() {
    if (vista.verificando) return 'verificando';
    return estadoAvisos({ seguro, ios, standalone, temPush, avisosLigados, permissao: permissaoAtual(), inscrito: vista.inscrito });
  }

  async function sub() {
    const reg = await esperar(navigator.serviceWorker.ready, 10000);
    return { reg, inscricao: await reg.pushManager.getSubscription() };
  }

  async function buscarChave() {
    const r = await pegarJson('/api/avisos/chave');
    if (!r || typeof r.chave !== 'string') throw new Error('chave inválida');
    chaveServidor = r.chave;
    return chaveServidor;
  }

  async function inscrever(reg) {
    const chave = chaveServidor ?? (await buscarChave());
    const inscricao = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64urlParaBytes(chave) });
    const r = await postarJson('/api/avisos/inscrever', inscricao.toJSON(), 15);
    if (!r.ok) {
      try { await inscricao.unsubscribe(); } catch { /* já saiu */ }
      throw new Error(r.erro || 'falha ao inscrever');
    }
    return inscricao;
  }

  // Cada carga com permissão concedida: confere a chave, refaz a inscrição se mudou e reenvia (upsert).
  async function sincronizar() {
    try {
      const { reg, inscricao } = await sub();
      const chave = await buscarChave();
      let atual = inscricao;
      if (atual && !chavesIguais(atual.options?.applicationServerKey, chave)) {
        try { await atual.unsubscribe(); } catch { /* já saiu */ }
        atual = null;
      }
      if (atual) {
        const r = await postarJson('/api/avisos/inscrever', atual.toJSON(), 15);
        vista.inscrito = r.ok;
        if (!r.ok) console.warn('avisos: não deu para reenviar a inscrição', r.erro);
      } else if (inscricao) {
        vista.inscrito = Boolean(await inscrever(reg));
      } else {
        vista.inscrito = false;
      }
    } catch (e) {
      console.warn('avisos: não deu para sincronizar', e);
    }
  }

  async function ativar() {
    vista.pedindo = true; vista.erro = false; vista.nota = ''; vista.teste = '';
    pintar();
    try {
      let perm;
      try { perm = await Notification.requestPermission(); } catch { perm = permissaoAtual(); }
      if (perm === 'granted') {
        const { reg } = await sub();
        await inscrever(reg);
        vista.inscrito = true;
        gravar();
        vista.foco = 'avisos-testar';
      } else if (perm === 'default') {
        vista.nota = 'Você fechou a pergunta. Toque de novo para ativar.';
        vista.foco = 'avisos-ativar';
      }
    } catch (e) {
      console.warn('avisos: falha ao ativar', e);
      vista.erro = true;
      vista.inscrito = false;
    }
    vista.pedindo = false;
    pintar();
  }

  async function desativar() {
    try {
      const { inscricao } = await sub();
      if (inscricao) {
        const endpoint = inscricao.endpoint;
        await postarJson('/api/avisos/cancelar', { endpoint }, 15); // não rejeita; falha não impede o resto
        try { await inscricao.unsubscribe(); } catch { /* já saiu */ }
      }
    } catch (e) {
      console.warn('avisos: falha ao desativar', e);
    }
    vista.inscrito = false; vista.teste = ''; vista.nota = '';
    vista.foco = 'avisos-ativar';
    pintar();
  }

  async function testar() {
    vista.testando = true; vista.teste = '';
    pintar();
    try {
      const { inscricao } = await sub();
      const r = inscricao ? await postarJson('/api/avisos/teste', { endpoint: inscricao.endpoint }, 20) : { ok: false };
      vista.teste = r.ok ? MSG_TESTE_OK : MSG_TESTE_ERRO;
    } catch {
      vista.teste = MSG_TESTE_ERRO;
    }
    vista.testando = false;
    vista.foco = 'avisos-testar';
    pintar();
    anunciar(vista.teste);
  }

  async function rechecar() {
    vista.erro = false;
    if (permissaoAtual() === 'granted') await sincronizar();
    pintar();
  }

  const nota = (texto) => el('p', { class: 'nota' }, texto);
  const botaoAtivar = (ocupado) => el('button', {
    type: 'button', id: 'avisos-ativar', class: `botao botao-principal${ocupado ? ' ocupado' : ''}`, disabled: ocupado,
  }, el('span', { class: 'gira', 'aria-hidden': 'true' }), el('span', { class: 'rotulo' }, ocupado ? 'Aguardando sua resposta…' : 'Ativar avisos'));

  function montar(est) {
    const itens = [];
    if (vista.erro) {
      itens.push(el('p', { class: 'aviso-erro', role: 'alert' }, MSG_ERRO, ' ',
        el('button', { type: 'button', id: 'avisos-de-novo', class: 'botao botao-link' }, 'Tentar de novo')));
    }
    if (est === 'verificando') return itens;
    if (est === 'indisponivel') {
      itens.push(el('p', {}, 'Avisos só funcionam pelo endereço seguro do Tailscale, aberto no celular.'));
      if (cfg.enderecoTailnet) itens.push(el('p', {}, el('code', { class: 'endereco' }, `https://${cfg.enderecoTailnet}/`)));
    } else if (est === 'sem-suporte') {
      itens.push(el('p', {}, 'Este navegador não aceita avisos. Use o Chrome no Android ou o Safari no iPhone (iOS 16.4 ou mais novo).'));
      if (iosAntigo({ ios, iosVersao })) itens.push(nota('Este iPhone está com o iOS antigo. Atualize para o iOS 16.4 ou mais novo.'));
    } else if (est === 'instalar') {
      itens.push(el('p', {}, 'No iPhone, os avisos só funcionam com a página na Tela de Início.'));
      itens.push(el('ol', { class: 'passos' },
        el('li', {}, 'Abra esta página no Safari.'),
        el('li', {}, 'Toque em Compartilhar (□↑).'),
        el('li', {}, 'Toque em "Adicionar à Tela de Início".'),
        el('li', {}, 'Abra pelo ícone do Rocky e toque em "Ativar avisos".')));
      itens.push(nota(NOTA_TAILSCALE));
    } else if (est === 'desligado-pc') {
      itens.push(el('p', {}, 'Os avisos estão desligados na configuração do monitor.'));
    } else if (est === 'bloqueado') {
      itens.push(el('p', {}, 'O navegador bloqueou os avisos desta página.'));
      itens.push(el('details', { class: 'avisos-como' },
        el('summary', {}, 'Como desbloquear'),
        el('ul', {},
          el('li', {}, 'Android: toque no cadeado ao lado do endereço, depois em Permissões, Notificações, Permitir.'),
          el('li', {}, 'iPhone: abra Ajustes, Notificações, Rocky e toque em Permitir.'))));
      itens.push(el('button', { type: 'button', id: 'avisos-rechecar', class: 'botao' }, 'Já desbloqueei'));
    } else if (est === 'pronto') {
      itens.push(el('p', {}, textoRegra(cfg)));
      itens.push(botaoAtivar(vista.pedindo));
      if (vista.pedindo) itens.push(el('p', { class: 'nota', role: 'status' }, 'Toque em Permitir na pergunta do navegador.'));
      else if (vista.nota) itens.push(el('p', { class: 'nota', role: 'status' }, vista.nota));
      itens.push(nota(NOTA_TAILSCALE));
    } else if (est === 'ativo') {
      itens.push(el('p', {}, textoRegra(cfg)));
      itens.push(el('div', { class: 'avisos-acoes' },
        el('button', { type: 'button', id: 'avisos-testar', class: `botao${vista.testando ? ' ocupado' : ''}`, disabled: vista.testando },
          el('span', { class: 'gira', 'aria-hidden': 'true' }), el('span', { class: 'rotulo' }, 'Enviar aviso de teste')),
        el('button', { type: 'button', id: 'avisos-desativar', class: 'botao' }, 'Desativar neste aparelho')));
      if (vista.teste) itens.push(el('p', { class: 'nota', role: 'status' }, vista.teste));
      itens.push(nota(NOTA_TAILSCALE));
    }
    return itens;
  }

  function pintar() {
    const est = estado();
    corpo.replaceChildren(...montar(est));
    corpo.setAttribute('aria-busy', String(est === 'verificando'));
    resumo.textContent = '';
    resumo.append(el('span', { class: 'avisos-nome' }, 'Avisos no celular'), el('span', { class: 'avisos-sep', 'aria-hidden': 'true' }, ' · '), el('span', { class: 'avisos-estado', 'data-estado': est }, ROTULOS[est]));
    document.getElementById('avisos').dataset.estado = est;
    if (ultimoEstado !== null && ultimoEstado !== est) anunciar(`Avisos no celular: ${ROTULOS[est]}`);
    ultimoEstado = est;
    const quer = vista.foco; vista.foco = null;
    if (quer) document.getElementById(quer)?.focus();
  }

  corpo.addEventListener('click', (e) => {
    const alvo = e.target instanceof Element ? e.target.closest('button') : null;
    if (!alvo || alvo.disabled) return;
    if (alvo.id === 'avisos-ativar') ativar();
    else if (alvo.id === 'avisos-testar') testar();
    else if (alvo.id === 'avisos-desativar') desativar();
    else if (alvo.id === 'avisos-rechecar') rechecar();
    else if (alvo.id === 'avisos-de-novo') { vista.erro = false; pintar(); document.getElementById('avisos-ativar')?.focus(); }
  });

  // Com a linha do tempo recolhida (trilho estreito), abrir o bloco expande o trilho como o clique nele.
  det.querySelector('summary').addEventListener('click', (e) => {
    if (!document.documentElement.classList.contains('dia-recolhida')) return;
    e.preventDefault();
    det.open = true;
    document.getElementById('dia-recolher')?.click();
  });

  // ---------- início ----------
  if (seguro && temSw) {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((e) => console.warn('avisos: service worker não registrou', e));
  }
  if (seguro && temPush && avisosLigados && permissaoAtual() === 'granted') {
    pintar();
    sincronizar().finally(() => { vista.verificando = false; pintar(); });
  } else {
    vista.verificando = false;
    pintar();
  }
}
