import { configDeteccao } from './config.js';
import { criarDetectorSom } from './som.js';
import { criarDetectorMovimento, tamanhoAnalise } from './movimento.js';
import { criarAgregador } from './agregador.js';
import { abrirPipeQuadros } from './pipe.js';
import { acharTrechos, recortarClipe } from './clipes.js';
import { caminhosEvento, montarRegistro, anexarRegistro, limparClipes, limparPorEspaco } from './registro.js';

const pausar = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Detecção de eventos (ROCKY-2): som pelo distribuidor de PCM, movimento pelos
 * quadros cinza que o ffmpeg manda por um pipe (só em `gravando`). Cada evento
 * fechado vira clipe + miniatura + linha em `eventos/AAAA-MM-DD.jsonl`, e só
 * então é emitido a quem chamou `aoEvento(fn)`.
 *
 * Uso: `const d = await iniciarDeteccao(cfg)`; passe `d.saidasExtras` ao
 * ffmpeg; depois `d.ligar({ distribuidor })`; no fim `await d.parar()`.
 * `deps` existe para os testes (relógio, pipe, recorte).
 */
export async function iniciarDeteccao(cfgBase, { log = console.log, deps = {} } = {}) {
  const cfg = configDeteccao(cfgBase);
  const relogio = deps.relogio ?? Date.now;
  const esperar = deps.esperar ?? pausar;
  const abrirPipe = deps.abrirPipe ?? abrirPipeQuadros;
  const achar = deps.acharTrechos ?? acharTrechos;
  const recortar = deps.recortarClipe ?? recortarClipe;
  const intervaloVerificarMs = deps.intervaloVerificarMs ?? 1000;

  const preMs = cfg.eventoPreSegundos * 1000;
  const posMs = cfg.eventoPosSegundos * 1000;
  const margemMs = cfg.clipeMargemSegundos * 1000;
  const ouvintes = new Set();
  let encerrando = false;
  let fila = Promise.resolve();
  const pendentes = new Set();
  const acordarPendentes = new Set();

  async function processar(evento) {
    if (!encerrando) {
      const falta = evento.fim + posMs + margemMs - relogio();
      if (falta > 0) {
        let acordar;
        await Promise.race([esperar(falta), new Promise((r) => { acordar = r; acordarPendentes.add(r); })]);
        acordarPendentes.delete(acordar);
      }
    }
    // Um recorte por vez (CPU), na ordem em que os eventos ficaram prontos.
    const r = fila.then(() => recortarEvento(evento));
    fila = r.catch(() => {});
    return r;
  }

  async function recortarEvento(evento) {
    const c = caminhosEvento({ pasta: cfg.pasta, evento, preMs });
    const inicioMs = evento.inicio - preMs;
    const fimMs = evento.fim + posMs;
    let clipe = null;
    let miniatura = null;
    try {
      const trechos = await achar({
        pasta: cfg.pasta, inicioMs, fimMs, ffprobe: cfg.ffprobe, trechoSegundos: cfg.trechoSegundos,
        sondagensSimultaneas: cfg.clipeSondagensSimultaneas, sondagemTimeoutMs: cfg.clipeSondagemTimeoutSegundos * 1000, log,
      });
      const r = await recortar({
        trechos, inicioMs, fimMs, destino: c.base,
        instanteMiniaturaMs: evento.picoMs ?? evento.inicio, cfg,
      });
      if (r.clipe) clipe = c.relClipe;
      if (r.miniatura) miniatura = c.relMiniatura;
      if (!r.clipe) log(`Evento ${evento.tipo}: sem trechos gravados na janela; registrado sem clipe.`);
    } catch (e) {
      log(`Evento ${evento.tipo}: não consegui recortar o clipe: ${e.message}`);
    }
    const registro = montarRegistro({ id: c.id, evento, clipe, miniatura });
    try { anexarRegistro(cfg.pasta, c.dia, registro); }
    catch (e) { log(`Evento ${evento.tipo}: não consegui gravar o registro: ${e.message}`); return registro; }
    log(`Evento ${evento.tipo} (${registro.inicio} a ${registro.fim}, intensidade ${registro.intensidade})${clipe ? `: ${clipe}` : ''}`);
    for (const fn of ouvintes) { try { fn(registro); } catch { /* um ouvinte com defeito não afeta os outros */ } }
    return registro;
  }

  function aoFechar(evento) {
    const p = processar(evento).catch((e) => log(`Evento ${evento.tipo}: ${e.message}`));
    pendentes.add(p);
    p.finally(() => pendentes.delete(p));
  }

  const agregadores = {
    som: criarAgregador({ tipo: 'som', juntarMs: cfg.eventoJuntarSegundos * 1000, maxMs: cfg.eventoMaxSegundos * 1000, aoFechar }),
    movimento: criarAgregador({ tipo: 'movimento', juntarMs: cfg.eventoJuntarSegundos * 1000, maxMs: cfg.eventoMaxSegundos * 1000, aoFechar }),
  };

  const som = criarDetectorSom({
    hz: Number(cfg.ouvirHz ?? 16000), limiarDb: cfg.somLimiarDb, janelaMs: cfg.somJanelaMs,
    duracaoMinimaMs: cfg.somDuracaoMinimaMs,
    aoAtividade: (t, i) => agregadores.som.atividade(t, i),
  });
  const tam = tamanhoAnalise(cfg.resolucao, cfg.movimentoLargura);
  const movimento = criarDetectorMovimento({
    largura: tam.largura, altura: tam.altura, limiarPixel: cfg.movimentoLimiarPixel,
    areaMinima: cfg.movimentoAreaMinima, quadrosSeguidos: cfg.movimentoQuadrosSeguidos,
    aoAtividade: (t, i) => agregadores.movimento.atividade(t, i),
  });

  const pipe = await abrirPipe({
    nome: cfg.movimentoCanal,
    aoConexao: () => movimento.reiniciar(),
    aoDados: (b) => movimento.processar(b, relogio()),
    log,
  });

  const verificar = setInterval(() => {
    const agora = relogio();
    agregadores.som.verificar(agora);
    agregadores.movimento.verificar(agora);
  }, intervaloVerificarMs);

  const limpar = () => {
    try { limparClipes({ pasta: cfg.pasta, dias: cfg.clipesDias, log }); }
    catch (e) { log(`Limpeza de clipes falhou: ${e.message}`); }
    try { limparPorEspaco({ pasta: cfg.pasta, maxGb: cfg.clipesMaxGb, livreMinGb: cfg.discoLivreMinGb, log }); }
    catch (e) { log(`Limpeza por espaço falhou: ${e.message}`); }
  };
  limpar();
  const timerLimpeza = setInterval(limpar, (Number(cfg.limpezaMinutos) || 5) * 60 * 1000);

  let cancelarSom = null;

  return {
    /** Saídas extras do ffmpeg: quadros cinza para o pipe, só quando há vídeo. */
    saidasExtras(estado, { video } = {}) {
      if (!video) return [];
      return [[
        '-map', video,
        '-vf', `fps=${cfg.movimentoFps},scale=${tam.largura}:${tam.altura},format=gray`,
        '-f', 'rawvideo', pipe.destinoFfmpeg,
      ]];
    },
    ligar({ distribuidor }) {
      cancelarSom?.();
      cancelarSom = distribuidor.inscrever((b) => som.processar(b, relogio()));
    },
    /** Inscreve `fn(registro)`, chamada uma vez por evento já gravado. Devolve a função de cancelar. */
    aoEvento(fn) { ouvintes.add(fn); return () => { ouvintes.delete(fn); }; },
    async parar() {
      encerrando = true;
      cancelarSom?.();
      clearInterval(verificar);
      clearInterval(timerLimpeza);
      agregadores.som.encerrar();
      agregadores.movimento.encerrar();
      for (const a of acordarPendentes) a();
      acordarPendentes.clear();
      await Promise.allSettled([...pendentes]);
      await pipe.fechar();
    },
  };
}
