// Linha do tempo do dia: navegação, régua de 24 h, horas, blocos e cartões de evento,
// mais apagar, guardar e a vista "Guardados".
import { pegarDias, pegarDia, pegarGuardados as pegarGuardadosApi, postarJson } from './api.js';
import {
  montarLista, segmentosDaHora, segundosDoIso, formatarHoraMinuto, larguraNaRegua,
  posicaoNaRegua, agruparBlocos, nivelIntensidade, rotuloTipo, rotuloHora, textoEventos, textoPilula, rotuloDia, vizinhosDoDia,
} from './linha-tempo.js';
import {
  textoConfirmaItem, textoConfirmaHora, textoConfirmaPasta, urlsGuardadas, estaGuardado, temGuardado,
  cruza, notaGuardado, textoParcial, textoFalhaApagar, anuncioItemApagado, anuncioHoraApagada, anuncioPastaApagada, anuncioGuardado,
} from './gravacoes.js';

function el(tag, classe, texto) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

export function criarDia({ cfg, aoTocar, player = null, anunciar = () => {}, pegarGuardados = pegarGuardadosApi }) {
  const $ = (id) => document.getElementById(id);
  const lista = $('lista');
  const regua = $('regua');
  const reguaHoras = $('regua-horas');
  const pilulaArea = $('pilula-area');
  const rotulo = $('dia-rotulo');
  const btnAnt = $('dia-anterior');
  const btnProx = $('dia-proximo');
  const btnHoje = $('dia-hoje');
  const pilula = $('pilula');
  const painelGuardados = $('guardados');
  const btnModoLinha = $('modo-linha');
  const btnModoGuardados = $('modo-guardados');

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
  let offline = true;
  let modo = 'linha'; // 'linha' | 'guardados'
  let guardados = [];
  let conjuntoGuardado = new Set();
  let guardadosEstado = 'carregando'; // 'carregando' | 'ok' | 'erro'
  // Render suspenso enquanto há confirmação aberta ou pedido no ar; o que chegar roda ao liberar.
  let confirmaAberta = null;
  let pedidos = 0;
  let renderPendente = false;
  let novosPendentes = new Set();
  const falhasGuardar = new Map(); // chave -> texto do último erro ao guardar
  const tempoApagar = () => cfg.controleTempoLimiteSegundos ?? 20;
  const tempoGuardar = () => Math.max(tempoApagar(), cfg.guardarMaxArquivos ?? 120);

  const ehHoje = () => diaAtual !== null && diaAtual === hoje;
  const travado = () => confirmaAberta !== null || pedidos > 0;

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
  function esqueleto(alvo = lista, n = 3) {
    alvo.replaceChildren(...Array.from({ length: n }, () => el('div', 'esqueleto')));
  }

  function mensagem(texto, botaoTexto, acao, alvo = lista) {
    const p = el('p', 'lista-vazia', texto);
    if (botaoTexto) {
      const b = el('button', 'botao botao-link', botaoTexto);
      b.type = 'button';
      b.addEventListener('click', acao);
      p.append(' ', b);
    }
    alvo.replaceChildren(p);
  }

  // ---------- render suspenso ----------
  function liberarRender() {
    if (travado() || !renderPendente) return;
    renderPendente = false;
    const novos = novosPendentes;
    novosPendentes = new Set();
    render(novos);
  }

  // Pede um render: com confirmação aberta ou pedido no ar, fica para quando fechar.
  function pedirRender(novos) {
    if (travado()) {
      renderPendente = true;
      if (novos) for (const id of novos) novosPendentes.add(id);
      return;
    }
    render(novos);
  }

  function renderAgora() {
    renderPendente = false;
    novosPendentes = new Set();
    render();
  }

  // ---------- botões e confirmação ----------
  function botaoAcao(texto, aria, classe = '') {
    const b = el('button', `botao ${classe}`.trim(), texto);
    b.type = 'button';
    b.setAttribute('aria-label', aria);
    b.dataset.rede = '1';
    b.disabled = offline;
    return b;
  }

  function ocupar(botao, texto) {
    botao.classList.add('ocupado');
    botao.removeAttribute('aria-label');
    const g = el('span', 'gira');
    g.setAttribute('aria-hidden', 'true');
    botao.replaceChildren(g, document.createTextNode(texto));
  }

  function aplicarOffline() {
    for (const n of document.querySelectorAll('.dia [data-rede]')) {
      if (n.classList.contains('ocupado')) continue;
      n.disabled = offline || n.dataset.fixo === '1';
    }
  }

  function fecharConfirma({ devolverFoco = true } = {}) {
    if (!confirmaAberta) return;
    const { zona, conf, origem, escondidos } = confirmaAberta;
    confirmaAberta = null;
    conf.remove();
    for (const [n, h] of escondidos) n.hidden = h;
    zona.classList.remove('com-confirma');
    if (devolverFoco) origem.focus();
    liberarRender();
  }

  /**
   * Abre a confirmação no lugar das ações (`zona`). Só uma por vez; o foco vai para Cancelar.
   * `pedido`: { texto, urlsAfetadas, enviar(), feitos(r), anuncio, posicao?(), focar?(pos), confiarErro? }.
   */
  function abrirConfirma(zona, origem, pedido) {
    fecharConfirma({ devolverFoco: false });
    const conf = el('div', 'confirma');
    conf.setAttribute('role', 'group');
    conf.setAttribute('aria-label', 'Confirmar apagar');
    const aviso = el('p', 'aviso-erro confirma-erro');
    aviso.setAttribute('role', 'alert');
    aviso.hidden = true;
    const sim = el('button', 'botao botao-perigo', 'Sim, apagar');
    sim.type = 'button';
    sim.dataset.rede = '1';
    sim.disabled = offline;
    const nao = el('button', 'botao', 'Cancelar');
    nao.type = 'button';
    conf.append(el('span', 'confirma-texto', pedido.texto), aviso, sim, nao);
    const escondidos = [...zona.children].map((n) => [n, n.hidden]);
    for (const [n] of escondidos) n.hidden = true;
    zona.classList.add('com-confirma');
    zona.append(conf);
    confirmaAberta = { zona, conf, origem, escondidos };
    conf.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && pedidos === 0) { e.stopPropagation(); fecharConfirma(); }
    });
    nao.addEventListener('click', () => fecharConfirma());
    sim.addEventListener('click', () => executarApagar({ conf, sim, nao, aviso }, pedido));
    nao.focus();
  }

  async function executarApagar({ conf, sim, nao, aviso }, pedido) {
    const hora = conf.closest('li.hora');
    const posicao = pedido.posicao?.();
    aviso.hidden = true;
    sim.disabled = true;
    nao.disabled = true;
    ocupar(sim, 'Apagando…');
    hora?.setAttribute('aria-busy', 'true');
    pedidos += 1;
    if (player && cruza(player.urls, pedido.urlsAfetadas)) {
      player.voltarAoVivo();
      anunciar('Voltou ao ao vivo.');
    }
    const r = await pedido.enviar();
    const parcial = !r.ok && r.status === 200 && r.falhas > 0;
    if (r.ok || parcial) {
      // Algo saiu: recarrega o dia e os guardados antes de soltar o render.
      await Promise.all([carregar(diaAtual, { silencioso: true }), carregarGuardados()]);
    }
    pedidos -= 1;
    hora?.removeAttribute('aria-busy');
    if (r.ok) {
      confirmaAberta = null;
      renderAgora();
      anunciar(pedido.anuncio);
      pedido.focar?.(posicao);
      return;
    }
    sim.classList.remove('ocupado');
    sim.textContent = 'Tentar de novo';
    sim.disabled = offline;
    nao.disabled = false;
    const usaServidor = pedido.confiarErro || (r.status >= 400 && r.status < 500);
    aviso.textContent = parcial ? textoParcial(pedido.feitos(r), r.falhas) : textoFalhaApagar(usaServidor ? r.erro : undefined);
    aviso.hidden = false;
    nao.focus();
  }

  async function guardar({ chave, urls, rotuloPasta, anuncioTexto, botao }) {
    falhasGuardar.delete(chave);
    ocupar(botao, 'Guardando…');
    botao.disabled = true;
    pedidos += 1;
    const r = await postarJson('/api/guardar', { urls, rotulo: rotuloPasta }, tempoGuardar());
    if (r.ok) await carregarGuardados();
    else falhasGuardar.set(chave, r.status >= 400 && r.status < 500 && r.erro ? r.erro : 'Não consegui guardar.');
    pedidos -= 1;
    renderAgora();
    const linha = [...lista.querySelectorAll('[data-chave]')].find((n) => n.dataset.chave === chave);
    if (r.ok) {
      anunciar(anuncioGuardado(anuncioTexto));
      linha?.querySelector('.botao-guardado')?.focus();
    } else {
      linha?.querySelector('.guardar-erro .botao-link')?.focus();
    }
  }

  /** Nós de guardar para uma zona de ações: botão, "✓ Guardado" ou botão com erro e nova tentativa. */
  function nosDeGuardar({ chave, urls, rotuloPasta, aria, anuncioTexto }) {
    if (estaGuardado(urls, conjuntoGuardado)) {
      const ok = el('button', 'botao botao-guardado', '✓ Guardado');
      ok.type = 'button';
      ok.setAttribute('aria-disabled', 'true');
      ok.setAttribute('aria-label', `Já guardado: ${aria.replace(/^Guardar /, '')}`);
      return [ok];
    }
    const b = botaoAcao('Guardar', aria);
    if (urls.length > (cfg.guardarMaxArquivos ?? 120)) {
      b.setAttribute('aria-label', `${aria}. Grande demais: no máximo ${cfg.guardarMaxArquivos} trechos por vez`);
      b.dataset.fixo = '1';
      b.disabled = true;
      return [b];
    }
    const pedido = () => guardar({ chave, urls, rotuloPasta, anuncioTexto, botao: b });
    b.addEventListener('click', pedido);
    const nos = [b];
    const texto = falhasGuardar.get(chave);
    if (texto) {
      const p = el('p', 'aviso-erro guardar-erro', texto);
      p.setAttribute('role', 'alert');
      const t = el('button', 'botao botao-link', 'Tentar de novo');
      t.type = 'button';
      t.dataset.rede = '1';
      t.disabled = offline;
      t.addEventListener('click', () => guardar({ chave, urls, rotuloPasta, anuncioTexto, botao: b }));
      p.append(' ', t);
      nos.push(p);
    }
    return nos;
  }

  function focarHora(hora) {
    const cab = hora !== undefined && hora !== null
      ? [...lista.querySelectorAll('.hora-cab')].find((n) => n.dataset.hora === String(hora)) : null;
    if (cab) { cab.focus(); return; }
    rotulo.tabIndex = -1;
    rotulo.focus();
  }

  // ---------- cartões ----------
  function cartaoEvento(ev, novo, item) {
    const s = segundosDoIso(ev.inicio);
    const hm = formatarHoraMinuto(s);
    const nivel = nivelIntensidade(ev.intensidade);
    const tipo = rotuloTipo(ev.tipo);
    const chave = `ev:${ev.id}`;
    const li = el('li', novo ? 'evento evento-novo' : 'evento');
    li.dataset.id = ev.id;
    li.dataset.chave = chave;
    const b = el('button', 'cartao-evento');
    b.type = 'button';
    b.dataset.rede = '1';
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
      b.dataset.fixo = '1';
    }
    b.disabled = offline || !ev.clipe;
    li.append(b);

    const zona = el('div', 'acoes-item');
    if (ev.clipe) {
      zona.append(...nosDeGuardar({
        chave, urls: [ev.clipe], rotuloPasta: `${tipo} ${diaAtual} ${hm}`,
        aria: `Guardar clipe de ${tipo} das ${hm}`, anuncioTexto: `Clipe das ${hm}`,
      }));
    }
    const apagar = botaoAcao('Apagar', `Apagar clipe de ${tipo} das ${hm}`, 'botao-perigo');
    apagar.addEventListener('click', () => abrirConfirma(zona, apagar, {
      texto: textoConfirmaItem(tipo, hm),
      urlsAfetadas: ev.clipe ? [ev.clipe] : [],
      enviar: () => postarJson('/api/apagar/evento', { dia: diaAtual, id: ev.id }, tempoApagar()),
      feitos: (r) => r.arquivos ?? 0,
      anuncio: anuncioItemApagado(hm),
      posicao: () => li.nextElementSibling?.dataset.id ?? null,
      focar: (idProximo) => {
        const prox = idProximo ? [...lista.querySelectorAll('li.evento')].find((n) => n.dataset.id === idProximo) : null;
        if (prox) prox.querySelector('.cartao-evento')?.focus(); else focarHora(item.hora);
      },
    }));
    zona.append(apagar);
    li.append(zona);
    return li;
  }

  function blocoLinha(bloco) {
    const de = formatarHoraMinuto(bloco.inicio);
    const ate = formatarHoraMinuto(bloco.fim);
    const tipoTexto = bloco.soAudio ? 'só som' : 'com vídeo';
    const linha = el('div', 'bloco-linha');
    const b = el('button', 'bloco', `${de}–${ate} · ${tipoTexto} ▶`);
    b.type = 'button';
    b.dataset.rede = '1';
    b.disabled = offline;
    b.addEventListener('click', () => {
      aoTocar({ urls: bloco.trechos.map((t) => t.url), soAudio: bloco.soAudio, rotulo: de });
    });
    linha.append(b);
    const urls = bloco.trechos.filter((t) => !t.emAndamento).map((t) => t.url);
    if (urls.length) {
      const chave = `bl:${bloco.hora}:${bloco.inicio}`;
      linha.dataset.chave = chave;
      const zona = el('div', 'acoes-item');
      zona.append(...nosDeGuardar({
        chave, urls, rotuloPasta: `Trechos ${diaAtual} ${de}–${ate}`,
        aria: `Guardar trecho ${de}–${ate} ${tipoTexto}`, anuncioTexto: `Trecho ${de}–${ate}`,
      }));
      linha.append(zona);
    }
    return linha;
  }

  function rodapeHora(item, painel) {
    const clipes = item.eventos.length;
    const trechos = cfg.apagarHoraTrechos ? item.blocos.flatMap((b) => b.trechos) : [];
    const urlsTrechos = trechos.filter((t) => !t.emAndamento).map((t) => t.url);
    if (!clipes && !urlsTrechos.length) return null;
    const nome = rotuloHora(item.hora);
    const urlsClipes = item.eventos.map((e) => e.clipe).filter(Boolean);
    const rodape = el('div', 'hora-rodape');
    const resumo = [clipes && (clipes === 1 ? '1 clipe' : `${clipes} clipes`), urlsTrechos.length && (urlsTrechos.length === 1 ? '1 trecho' : `${urlsTrechos.length} trechos`)].filter(Boolean).join(' e ');
    const b = botaoAcao('Apagar esta hora', `Apagar esta hora, ${nome}, ${resumo}`, 'botao-perigo');
    b.addEventListener('click', () => abrirConfirma(rodape, b, {
      texto: textoConfirmaHora({ hora: nome, clipes, trechos: urlsTrechos.length, comGuardado: temGuardado([...urlsClipes, ...urlsTrechos], conjuntoGuardado) }),
      urlsAfetadas: [...urlsClipes, ...urlsTrechos],
      enviar: () => postarJson('/api/apagar/hora', {
        dia: diaAtual, hora: item.hora, ids: item.eventos.map((e) => e.id), trechos: Boolean(cfg.apagarHoraTrechos),
      }, tempoApagar()),
      feitos: (r) => (r.eventos ?? 0) + (r.trechos ?? 0),
      anuncio: anuncioHoraApagada({ hora: nome, clipes }),
      posicao: () => {
        for (let n = painel.parentElement?.nextElementSibling; n; n = n.nextElementSibling) {
          const cab = n.querySelector?.('.hora-cab');
          if (cab) return cab.dataset.hora;
        }
        return null;
      },
      focar: (proxima) => focarHora(proxima),
    }));
    rodape.append(b);
    return rodape;
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
      for (const b of [...item.blocos].reverse()) bl.append(blocoLinha(b));
      painel.append(bl);
    }
    if (item.eventos.length) {
      const ul = el('ul', 'eventos');
      for (const ev of [...item.eventos].reverse()) ul.append(cartaoEvento(ev, novosIds.has(ev.id), item));
      painel.append(ul);
    }
    const rodape = rodapeHora(item, painel);
    if (rodape) painel.append(rodape);
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

  // ---------- guardados ----------
  function desenharGuardados() {
    painelGuardados.setAttribute('aria-busy', String(guardadosEstado === 'carregando'));
    if (guardadosEstado === 'carregando') { esqueleto(painelGuardados, 2); return; }
    if (guardadosEstado === 'erro') {
      mensagem('Não consegui carregar os guardados.', 'Tentar de novo', () => {
        guardadosEstado = 'carregando';
        render();
        carregarGuardados();
      }, painelGuardados);
      return;
    }
    if (!guardados.length) {
      mensagem('Nada guardado ainda. Use Guardar num clipe ou trecho da linha do tempo.', null, null, painelGuardados);
      return;
    }
    const ul = el('ul', 'guardados');
    for (const g of guardados) ul.append(itemGuardado(g));
    painelGuardados.replaceChildren(ul);
  }

  function itemGuardado(g) {
    const li = el('li', 'guardado');
    li.dataset.nome = g.nome;
    const info = el('div', 'guardado-info');
    if (g.miniatura) {
      const img = el('img', 'miniatura');
      img.alt = '';
      img.loading = 'lazy';
      img.width = 96;
      img.height = 54;
      img.src = g.miniatura;
      info.append(img);
    }
    const txt = el('div', 'guardado-texto');
    txt.append(el('span', 'guardado-titulo', g.rotulo), el('span', 'nota', notaGuardado(g, cfg.trechoSegundos)));
    info.append(txt);
    li.append(info);
    const urls = (g.arquivos || []).map((a) => a.url);
    const zona = el('div', 'acoes-item');
    const tocar = botaoAcao('▶ Tocar', `Tocar pasta ${g.rotulo}`);
    tocar.addEventListener('click', () => {
      aoTocar({ urls, soAudio: (g.arquivos || []).every((a) => a.soAudio), rotulo: g.rotulo, prefixo: 'Guardado' });
    });
    const apagar = botaoAcao('Apagar', `Apagar pasta ${g.rotulo}`, 'botao-perigo');
    apagar.addEventListener('click', () => abrirConfirma(zona, apagar, {
      texto: textoConfirmaPasta(g.rotulo, urls.length),
      urlsAfetadas: urls,
      enviar: () => postarJson('/api/guardados/apagar', { nome: g.nome }, tempoApagar()),
      feitos: () => 0,
      confiarErro: true,
      anuncio: anuncioPastaApagada(g.rotulo),
      posicao: () => li.nextElementSibling?.dataset.nome ?? null,
      focar: (nomeProximo) => {
        const itens = [...painelGuardados.querySelectorAll('li.guardado')];
        const alvo = itens.find((n) => n.dataset.nome === nomeProximo) ?? itens[0];
        (alvo?.querySelector('.botao') ?? btnModoGuardados).focus();
      },
    }));
    zona.append(tocar, apagar);
    li.append(zona);
    return li;
  }

  async function carregarGuardados() {
    try {
      const r = await pegarGuardados();
      guardados = Array.isArray(r?.guardados) ? r.guardados : [];
      conjuntoGuardado = urlsGuardadas(guardados);
      guardadosEstado = 'ok';
    } catch {
      if (guardadosEstado !== 'ok') guardadosEstado = 'erro';
    }
    pedirRender();
  }

  function desenharModo() {
    btnModoLinha.setAttribute('aria-pressed', String(modo === 'linha'));
    btnModoGuardados.setAttribute('aria-pressed', String(modo === 'guardados'));
    btnModoGuardados.textContent = guardadosEstado === 'ok' ? `Guardados (${guardados.length})` : 'Guardados';
    // Os Guardados não são de um dia: a navegação de dias some junto com a régua.
    for (const n of [rotulo.closest('.dia-nav'), regua, reguaHoras, pilulaArea, lista]) n.hidden = modo !== 'linha';
    painelGuardados.hidden = modo !== 'guardados';
  }

  function trocarModo(novo) {
    if (pedidos > 0 || novo === modo) return;
    fecharConfirma({ devolverFoco: false });
    modo = novo;
    renderAgora();
    if (modo === 'guardados') carregarGuardados();
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
    if (modo === 'guardados') desenharGuardados();
    desenharModo();
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
      pedirRender();
    } catch {
      if (minha !== sequencia) return;
      if (silencioso && dados) return;
      erro = true;
      dados = null;
      pedirRender();
    }
  }

  async function irPara(dia) {
    fecharConfirma({ devolverFoco: false });
    diaAtual = dia;
    abertas = new Set();
    primeiraAbertura = true;
    pendentes = [];
    desenharNav();
    await carregar(dia);
  }

  async function iniciar() {
    carregarGuardados();
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

  btnAnt.addEventListener('click', () => { const v = vizinhosDoDia(dias, diaAtual); if (v.anterior && !pedidos) irPara(v.anterior); });
  btnProx.addEventListener('click', () => { const v = vizinhosDoDia(dias, diaAtual); if (v.proximo && !pedidos) irPara(v.proximo); });
  btnHoje.addEventListener('click', () => { if (hoje && !pedidos) irPara(hoje); });
  btnModoLinha.addEventListener('click', () => trocarModo('linha'));
  btnModoGuardados.addEventListener('click', () => trocarModo('guardados'));
  pilula.addEventListener('click', () => {
    if (dados) for (const e of pendentes) if (!dados.eventos.some((x) => x.id === e.id)) dados.eventos.push(e);
    const novos = new Set(pendentes.map((e) => e.id));
    pendentes = [];
    assinatura = JSON.stringify(dados);
    pedirRender(novos);
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
    /** Sem conexão com o monitor: Guardar, Apagar e Tocar ficam desativados. */
    definirOffline(sem) {
      offline = Boolean(sem);
      aplicarOffline();
    },
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
      pedirRender(new Set([ev.id]));
      setTimeout(() => lista.querySelectorAll('.evento-novo').forEach((n) => n.classList.remove('evento-novo')), 2000);
    },
  };
}
