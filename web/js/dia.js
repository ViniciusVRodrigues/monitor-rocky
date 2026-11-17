// Linha do tempo do dia: navegação, régua de 24 h, horas, blocos e cartões de evento.
import { pegarDias, pegarDia } from './api.js';
import {
  montarLista, segmentosDaHora, segundosDoIso, formatarHoraMinuto, larguraNaRegua,
  posicaoNaRegua, agruparBlocos, nivelIntensidade, rotuloTipo, rotuloHora, textoEventos, textoPilula, rotuloDia, vizinhosDoDia,
} from './linha-tempo.js';

function el(tag, classe, texto) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

export function criarDia({ cfg, aoTocar }) {
  const $ = (id) => document.getElementById(id);
  const lista = $('lista');
  const regua = $('regua');
  const rotulo = $('dia-rotulo');
  const btnAnt = $('dia-anterior');
  const btnProx = $('dia-proximo');
  const btnHoje = $('dia-hoje');
  const pilula = $('pilula');

  let dias = [];
  let hoje = null;
  let diaAtual = null;
  let dados = null;
  let assinatura = '';
  let abertas = new Set();
  let primeiraAbertura = true;
  let pendentes = [];
  let erro = false;
  let timer = null;
  let sequencia = 0;

  const ehHoje = () => diaAtual !== null && diaAtual === hoje;

  // "Rolada" = a pessoa já desceu a página (celular) ou a coluna (computador): não mexer no que ela vê.
  function listaRolada() {
    return window.scrollY > 8 || lista.scrollTop > 8 || (lista.parentElement?.scrollTop ?? 0) > 8;
  }

  // ---------- régua ----------
  function desenharRegua() {
    regua.replaceChildren();
    if (!dados) return;
    for (const b of agruparBlocos(dados.trechos, cfg.trechoSegundos)) {
      const f = el('span', b.soAudio ? 'regua-faixa regua-audio' : 'regua-faixa regua-video');
      f.style.left = `${posicaoNaRegua(b.inicio)}%`;
      f.style.width = `${Math.max(0.3, larguraNaRegua(b.inicio, b.fim - b.inicio))}%`;
      regua.append(f);
    }
    for (const ev of dados.eventos) {
      const s = segundosDoIso(ev.inicio);
      if (Number.isNaN(s)) continue;
      const t = el('span', `regua-evento nivel-${nivelIntensidade(ev.intensidade) === 'média' ? 'media' : nivelIntensidade(ev.intensidade)}`);
      t.style.left = `${posicaoNaRegua(s)}%`;
      regua.append(t);
    }
  }

  // ---------- lista ----------
  function esqueleto() {
    lista.replaceChildren(el('div', 'esqueleto'), el('div', 'esqueleto'), el('div', 'esqueleto'));
  }

  function mensagem(texto, botaoTexto, acao) {
    const p = el('p', 'lista-vazia', texto);
    if (botaoTexto) {
      const b = el('button', 'botao botao-link', botaoTexto);
      b.type = 'button';
      b.addEventListener('click', acao);
      p.append(' ', b);
    }
    lista.replaceChildren(p);
  }

  function cartaoEvento(ev, novo) {
    const li = el('li', novo ? 'evento evento-novo' : 'evento');
    const b = el('button', 'cartao-evento');
    b.type = 'button';
    const s = segundosDoIso(ev.inicio);
    const hm = formatarHoraMinuto(s);
    const nivel = nivelIntensidade(ev.intensidade);
    const tipo = rotuloTipo(ev.tipo);
    b.setAttribute('aria-label', `${tipo} às ${hm}, intensidade ${nivel}${ev.clipe ? ', tocar clipe' : ', sem clipe'}`);
    if (ev.miniatura) {
      const img = el('img', 'miniatura');
      img.alt = '';
      img.loading = 'lazy';
      img.width = 96;
      img.height = 54;
      img.src = ev.miniatura;
      b.append(img);
    } else {
      b.append(el('span', 'miniatura miniatura-vazia'));
    }
    const txt = el('span', 'evento-texto');
    txt.append(el('span', 'evento-titulo', `${hm} · ${tipo}`));
    const barras = el('span', `barras barras-${nivel === 'média' ? 'media' : nivel}`);
    barras.setAttribute('aria-hidden', 'true');
    barras.append(el('i'), el('i'), el('i'));
    const linha = el('span', 'evento-nivel');
    linha.append(barras, document.createTextNode(` ${nivel}`));
    txt.append(linha);
    b.append(txt);
    if (ev.clipe) {
      b.addEventListener('click', () => aoTocar({ urls: [ev.clipe], soAudio: false, rotulo: hm }));
    } else {
      b.disabled = true;
    }
    li.append(b);
    return li;
  }

  function blocoBotao(bloco) {
    const b = el('button', 'bloco');
    b.type = 'button';
    const texto = `${formatarHoraMinuto(bloco.inicio)}–${formatarHoraMinuto(bloco.fim)} · ${bloco.soAudio ? 'só som' : 'com vídeo'} ▶`;
    b.textContent = texto;
    b.addEventListener('click', () => {
      aoTocar({ urls: bloco.trechos.map((t) => t.url), soAudio: bloco.soAudio, rotulo: formatarHoraMinuto(bloco.inicio) });
    });
    return b;
  }

  function linhaHora(item, novosIds) {
    const li = el('li', 'hora');
    const painelId = `hora-${item.hora}`;
    const aberta = abertas.has(item.hora);
    const cab = el('button', 'hora-cab');
    cab.type = 'button';
    cab.setAttribute('aria-expanded', String(aberta));
    cab.setAttribute('aria-controls', painelId);
    cab.dataset.hora = String(item.hora);
    cab.append(el('span', 'hora-nome', rotuloHora(item.hora)));
    const mini = el('span', 'mini-regua');
    mini.setAttribute('aria-hidden', 'true');
    for (const seg of segmentosDaHora(item.blocos, item.hora)) {
      const f = el('span', seg.soAudio ? 'regua-faixa regua-audio' : 'regua-faixa regua-video');
      f.style.left = `${seg.de}%`;
      f.style.width = `${Math.max(1, seg.para - seg.de)}%`;
      mini.append(f);
    }
    cab.append(mini);
    cab.append(el('span', 'hora-eventos', item.eventos.length ? textoEventos(item.eventos.length) : ''));
    cab.addEventListener('click', () => {
      if (abertas.has(item.hora)) abertas.delete(item.hora); else abertas.add(item.hora);
      cab.setAttribute('aria-expanded', String(abertas.has(item.hora)));
      painel.hidden = !abertas.has(item.hora);
    });
    li.append(cab);
    const painel = el('div', 'hora-painel');
    painel.id = painelId;
    painel.hidden = !aberta;
    if (!item.blocos.length) {
      painel.append(el('p', 'nota', `Trechos já apagados (guardamos ${cfg.bufferHoras} h). Os clipes dos eventos continuam.`));
    } else {
      const bl = el('div', 'blocos');
      // Mais recente primeiro, como as horas e os eventos.
      for (const b of [...item.blocos].reverse()) bl.append(blocoBotao(b));
      painel.append(bl);
    }
    if (item.eventos.length) {
      const ul = el('ul', 'eventos');
      for (const ev of [...item.eventos].reverse()) ul.append(cartaoEvento(ev, novosIds.has(ev.id)));
      painel.append(ul);
    }
    li.append(painel);
    return li;
  }

  function desenharLista(novosIds = new Set()) {
    lista.setAttribute('aria-busy', 'false');
    if (erro) { mensagem('Não consegui carregar a linha do tempo.', 'Tentar de novo', () => carregar(diaAtual)); return; }
    if (!dados) { esqueleto(); return; }
    if (!dados.trechos.length && !dados.eventos.length) {
      mensagem(`Nada gravado neste dia. Os trechos ficam guardados por ${cfg.bufferHoras} horas.`);
      return;
    }
    const agora = new Date();
    const itens = montarLista({
      trechos: dados.trechos, eventos: dados.eventos, trechoSegundos: cfg.trechoSegundos,
      ate: ehHoje() ? agora.getHours() : 23,
    });
    if (primeiraAbertura) {
      const primeira = itens.find((i) => i.tipo === 'hora');
      if (primeira) abertas.add(primeira.hora);
      primeiraAbertura = false;
    }
    const ul = el('ul', 'horas');
    for (const item of itens) {
      if (item.tipo === 'vazio') ul.append(el('li', 'hora-vazia', item.rotulo));
      else ul.append(linhaHora(item, novosIds));
    }
    lista.replaceChildren(ul);
  }

  function desenharNav() {
    rotulo.textContent = diaAtual ? rotuloDia(diaAtual, hoje) : 'Hoje';
    const v = vizinhosDoDia(dias, diaAtual);
    btnAnt.disabled = !v.anterior;
    btnProx.disabled = !v.proximo;
    btnHoje.hidden = ehHoje() || !hoje;
  }

  function desenharPilula() {
    if (!pendentes.length) { pilula.hidden = true; pilula.textContent = ''; return; }
    pilula.hidden = false;
    pilula.textContent = textoPilula(pendentes.length);
  }

  function render(novosIds) {
    desenharNav();
    desenharRegua();
    desenharLista(novosIds);
    desenharPilula();
  }

  // ---------- dados ----------
  async function carregar(dia, { silencioso = false } = {}) {
    const minha = ++sequencia;
    if (!silencioso) { dados = null; erro = false; lista.setAttribute('aria-busy', 'true'); esqueleto(); }
    try {
      const novo = await pegarDia(dia);
      if (minha !== sequencia) return;
      erro = false;
      const sig = JSON.stringify(novo);
      if (dados && sig === assinatura) return;
      assinatura = sig;
      dados = novo;
      if (dia === hoje) pendentes = pendentes.filter((p) => !dados.eventos.some((e) => e.id === p.id));
      render();
    } catch {
      if (minha !== sequencia) return;
      if (silencioso && dados) return;
      erro = true;
      dados = null;
      render();
    }
  }

  async function irPara(dia) {
    diaAtual = dia;
    abertas = new Set();
    primeiraAbertura = true;
    pendentes = [];
    desenharNav();
    await carregar(dia);
  }

  async function iniciar() {
    try {
      const r = await pegarDias();
      dias = r.dias || [];
      hoje = r.hoje;
      if (!dias.includes(hoje)) dias = [hoje, ...dias];
    } catch {
      erro = true;
      hoje = null;
    }
    if (hoje) await irPara(hoje); else { desenharNav(); render(); }
    clearInterval(timer);
    timer = setInterval(() => { if (ehHoje() && !document.hidden) carregar(diaAtual, { silencioso: true }); }, cfg.linhaTempoAtualizarSegundos * 1000);
  }

  btnAnt.addEventListener('click', () => { const v = vizinhosDoDia(dias, diaAtual); if (v.anterior) irPara(v.anterior); });
  btnProx.addEventListener('click', () => { const v = vizinhosDoDia(dias, diaAtual); if (v.proximo) irPara(v.proximo); });
  btnHoje.addEventListener('click', () => { if (hoje) irPara(hoje); });
  pilula.addEventListener('click', () => {
    if (dados) for (const e of pendentes) if (!dados.eventos.some((x) => x.id === e.id)) dados.eventos.push(e);
    const novos = new Set(pendentes.map((e) => e.id));
    pendentes = [];
    assinatura = JSON.stringify(dados);
    render(novos);
    lista.scrollIntoView({ block: 'start' });
    lista.parentElement?.scrollTo?.({ top: 0 });
    setTimeout(() => lista.querySelectorAll('.evento-novo').forEach((n) => n.classList.remove('evento-novo')), 2000);
  });
  regua.addEventListener('click', (e) => {
    if (!matchMedia('(min-width: 1024px)').matches) return;
    const r = regua.getBoundingClientRect();
    const hora = Math.min(23, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * 24)));
    for (let h = hora; h >= 0; h--) {
      const cab = lista.querySelector(`[data-hora="${h}"]`);
      if (cab) { cab.scrollIntoView({ block: 'nearest' }); break; }
    }
  });

  return {
    iniciar,
    /** Evento novo vindo do SSE. */
    novoEvento(ev) {
      if (!ehHoje() || !dados) return;
      if (dados.eventos.some((x) => x.id === ev.id) || pendentes.some((x) => x.id === ev.id)) return;
      if (listaRolada()) {
        pendentes.push(ev);
        desenharPilula();
        return;
      }
      dados.eventos.push(ev);
      dados.eventos.sort((a, b) => segundosDoIso(a.inicio) - segundosDoIso(b.inicio));
      assinatura = JSON.stringify(dados);
      const hora = Math.floor(segundosDoIso(ev.inicio) / 3600);
      abertas.add(hora);
      render(new Set([ev.id]));
      setTimeout(() => lista.querySelectorAll('.evento-novo').forEach((n) => n.classList.remove('evento-novo')), 2000);
    },
  };
}
