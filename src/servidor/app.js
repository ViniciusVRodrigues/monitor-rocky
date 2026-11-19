import http from 'node:http';
import { cabecalhosBase, hostPermitido, recusaTailscale, leituraPermitida, controlePermitido, json, naoEncontrado } from './seguranca.js';
import { resolverGravacao, resolverEstatico, resolverVendor, servirArquivo } from './arquivos.js';
import { listarDias, lerDia, diaValido } from './linha-tempo.js';
import { executarControle, ControleErro, estadoAtual } from './controle.js';
import { criarAoVivo } from './ao-vivo.js';
import { criarOuvirSite } from './ouvir-site.js';
import { AvisoErro } from '../avisos/endpoint.js';
import { apagarEvento, apagarHora, guardar, listarGuardados, apagarGuardado, nomeGuardados, GravacaoErro } from './gravacoes.js';

const MAX_CORPO = 1024;
const MAX_CORPO_GRAVACOES = 16 * 1024;
const MAX_CORPO_AVISOS = 4096;
const AVISO_TESTE = {
  titulo: 'Rocky', corpo: 'Aviso de teste. Se você está vendo isto, os avisos funcionam.', url: '/', tag: 'rocky-teste',
};

/** ISO 8601 com o deslocamento local (ex.: 2026-11-17T14:03:05-03:00). */
export function isoLocal(d = new Date()) {
  const p = (n, t = 2) => String(n).padStart(t, '0');
  const off = -d.getTimezoneOffset();
  const sinal = off >= 0 ? '+' : '-';
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}` +
    `${sinal}${p(Math.floor(Math.abs(off) / 60))}:${p(Math.abs(off) % 60)}`;
}

function lerCorpo(req, max = MAX_CORPO) {
  return new Promise((resolve, reject) => {
    const partes = []; let total = 0;
    req.on('data', (b) => {
      total += b.length;
      if (total > max) { reject(new ControleErro(413, 'Pedido grande demais.')); req.destroy(); return; }
      partes.push(b);
    });
    req.on('end', () => resolve(Buffer.concat(partes).toString('utf8')));
    req.on('error', reject);
  });
}

/**
 * Servidor HTTP local (só 127.0.0.1). `antes` é uma lista de funções async
 * (req, res) => boolean, chamadas depois da checagem de Host e antes das rotas.
 * `aoEvento(fn)` registra o ouvinte de eventos novos da detecção (opcional).
 */
export function criarServidor({ cfg, raiz, monitor, aoEvento, antes = [], spawn, avisos, log = () => {}, agora = () => new Date() }) {
  const ouvirSite = criarOuvirSite({ cfg, distribuidor: monitor.distribuidor, spawn, log });
  const aoVivo = criarAoVivo({ cfg, monitor, aoEvento });
  let porta = 0;
  const avisosLigados = Boolean(avisos?.ligado);

  const apiConfig = () => ({
    ouvirModo: cfg.ouvirModo ?? 'auto', ouvirHz: cfg.ouvirHz,
    aovivoConectarSegundos: cfg.aovivoConectarSegundos ?? 15,
    ouvirGanhoDb: cfg.ouvirGanhoDb ?? 0, ouvirCompLimiarDb: cfg.ouvirCompLimiarDb ?? -18,
    ouvirCompJoelhoDb: cfg.ouvirCompJoelhoDb ?? 12, ouvirCompRazao: cfg.ouvirCompRazao ?? 12, ouvirFolgaMs: cfg.ouvirFolgaMs ?? 300,
    ouvirAtrasoMaxMs: cfg.ouvirAtrasoMaxMs ?? 1000, ouvirMp3AtrasoMaxSegundos: cfg.ouvirMp3AtrasoMaxSegundos ?? 4,
    linhaTempoAtualizarSegundos: cfg.linhaTempoAtualizarSegundos ?? 30,
    bufferHoras: cfg.bufferHoras, trechoSegundos: cfg.trechoSegundos,
    aovivoSegundos: cfg.aovivoSegundos, aovivoSegmentos: cfg.aovivoSegmentos,
    controleTempoLimiteSegundos: cfg.controleTempoLimiteSegundos ?? 20,
    somAoAbrir: cfg.somAoAbrir ?? true, nivelHz: cfg.nivelHz ?? 10,
    guardarMaxArquivos: cfg.guardarMaxArquivos ?? 120,
    apagarHoraTrechos: cfg.apagarHoraTrechos ?? true,
    avisos: avisosLigados,
    avisoSomSegundos: cfg.avisoSomSegundos ?? 20, avisoIntervaloMinutos: cfg.avisoIntervaloMinutos ?? 10,
    avisoSilencioInicio: cfg.avisoSilencioInicio ?? '', avisoSilencioFim: cfg.avisoSilencioFim ?? '',
    enderecoTailnet: (cfg.hostsPermitidos ?? [])[0] ?? '',
  });

  async function controle(req, res) {
    if (!controlePermitido(req)) return json(res, 403, { ok: false, erro: 'Pedido recusado.' });
    let acao;
    try {
      const corpo = JSON.parse(await lerCorpo(req));
      acao = corpo && typeof corpo === 'object' ? corpo.acao : undefined;
    } catch (e) {
      if (e instanceof ControleErro) return json(res, e.status, { ok: false, erro: e.message });
      return json(res, 400, { ok: false, erro: 'Ação desconhecida.' });
    }
    try {
      const r = await executarControle(monitor, acao, (cfg.controleTempoLimiteSegundos ?? 20) * 1000);
      aoVivo.emitirEstado();
      json(res, 200, { ok: true, ...r });
    } catch (e) {
      if (e instanceof ControleErro) return json(res, e.status, { ok: false, erro: e.message });
      json(res, 500, { ok: false, erro: e.message || 'Não deu para executar a ação.' });
    }
  }

  const guardadosNome = nomeGuardados(cfg);

  /** Rotas POST de apagar e guardar: mesma proteção do controle, corpo JSON de até 16 KB. */
  const ESCRITA = {
    '/api/apagar/evento': (corpo) => apagarEvento(cfg.pasta, corpo),
    '/api/apagar/hora': (corpo) => apagarHora(cfg.pasta, corpo, { agora: agora(), trechoSegundos: cfg.trechoSegundos }),
    '/api/guardar': (corpo) => guardar(cfg, corpo, { agora: agora() }),
    '/api/guardados/apagar': (corpo) => apagarGuardado(cfg, corpo),
  };

  async function escrita(req, res, fn) {
    if (!controlePermitido(req)) return json(res, 403, { ok: false, erro: 'Pedido recusado.' });
    let corpo;
    try {
      corpo = JSON.parse(await lerCorpo(req, MAX_CORPO_GRAVACOES));
    } catch (e) {
      if (e instanceof ControleErro) return json(res, e.status, { ok: false, erro: e.message });
      return json(res, 400, { ok: false, erro: 'Pedido inválido.' });
    }
    if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) return json(res, 400, { ok: false, erro: 'Pedido inválido.' });
    try {
      const r = await fn(corpo);
      json(res, req.url.startsWith('/api/guardar') && r.guardado ? 201 : 200, r);
    } catch (e) {
      if (e instanceof GravacaoErro) return json(res, e.status, { ok: false, erro: e.message });
      log(`Erro ao apagar/guardar: ${e.message}`);
      json(res, 500, { ok: false, erro: 'Não deu para concluir.' });
    }
  }

  /** POST de avisos: mesma proteção do controle, corpo JSON de até 4 KB. */
  const AVISOS_POST = {
    '/api/avisos/inscrever': (corpo) => { avisos.inscrever(corpo); return { ok: true }; },
    '/api/avisos/cancelar': (corpo) => {
      if (typeof corpo.endpoint !== 'string' || !corpo.endpoint) throw new AvisoErro(400, 'Endereço da inscrição inválido.');
      avisos.cancelar(corpo.endpoint);
      return { ok: true };
    },
    '/api/avisos/teste': async (corpo) => {
      if (typeof corpo.endpoint !== 'string' || !corpo.endpoint) throw new AvisoErro(400, 'Endereço da inscrição inválido.');
      await avisos.enviarPara(corpo.endpoint, AVISO_TESTE);
      return { ok: true };
    },
  };

  async function avisosPost(req, res, fn) {
    if (!controlePermitido(req)) return json(res, 403, { ok: false, erro: 'Pedido recusado.' });
    let corpo;
    try {
      corpo = JSON.parse(await lerCorpo(req, MAX_CORPO_AVISOS));
    } catch (e) {
      if (e instanceof ControleErro) return json(res, e.status, { ok: false, erro: e.message });
      return json(res, 400, { ok: false, erro: 'Pedido inválido.' });
    }
    if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) return json(res, 400, { ok: false, erro: 'Pedido inválido.' });
    try {
      json(res, 200, await fn(corpo));
    } catch (e) {
      if (e instanceof AvisoErro) return json(res, e.status, { ok: false, erro: e.message });
      log(`Erro nos avisos: ${e.message}`);
      json(res, 500, { ok: false, erro: 'Não deu para concluir.' });
    }
  }

  async function rotear(req, res) {
    const url = req.url ?? '/';
    if (!url.startsWith('/')) return naoEncontrado(res);
    const caminho = url.split('?')[0].split('#')[0];

    if (caminho === '/api/controle') {
      if (req.method !== 'POST') return json(res, 405, { ok: false, erro: 'Método não permitido.' }, { Allow: 'POST' });
      return controle(req, res);
    }
    if (Object.hasOwn(AVISOS_POST, caminho)) {
      if (!avisosLigados) return naoEncontrado(res);
      if (req.method !== 'POST') return json(res, 405, { ok: false, erro: 'Método não permitido.' }, { Allow: 'POST' });
      return avisosPost(req, res, AVISOS_POST[caminho]);
    }
    if (Object.hasOwn(ESCRITA, caminho)) {
      if (req.method !== 'POST') return json(res, 405, { ok: false, erro: 'Método não permitido.' }, { Allow: 'POST' });
      return escrita(req, res, ESCRITA[caminho]);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return json(res, 405, { ok: false, erro: 'Método não permitido.' }, { Allow: 'GET, HEAD' });
    }

    const ehApi = caminho.startsWith('/api/');
    const ehFluxo = caminho.startsWith('/aovivo/') || caminho.startsWith('/arquivos/');
    if ((ehApi || ehFluxo) && !leituraPermitida(req)) return json(res, 403, { ok: false, erro: 'Pedido recusado.' });

    if (ehApi) {
      if (caminho === '/api/config') return json(res, 200, apiConfig());
      if (caminho === '/api/estado') return json(res, 200, { ...estadoAtual(monitor), agora: isoLocal(agora()) });
      if (caminho === '/api/avisos/chave' && avisosLigados) return json(res, 200, { chave: avisos.chavePublica() });
      if (caminho === '/api/guardados') return json(res, 200, listarGuardados(cfg));
      if (caminho === '/api/dias') return json(res, 200, listarDias(cfg.pasta, agora()));
      if (caminho.startsWith('/api/dia/')) {
        const dia = caminho.slice('/api/dia/'.length);
        if (!diaValido(dia)) return json(res, 400, { ok: false, erro: 'Dia inválido.' });
        return json(res, 200, lerDia(cfg.pasta, dia, { agora: agora(), trechoSegundos: cfg.trechoSegundos }));
      }
      if (req.method === 'GET') {
        if (caminho === '/api/ao-vivo') return aoVivo.atender(req, res);
        if (caminho === '/api/ouvir/pcm') return ouvirSite.pcm(req, res);
        if (caminho === '/api/ouvir/mp3') return ouvirSite.mp3(req, res);
      }
      return naoEncontrado(res);
    }

    const r = ehFluxo ? resolverGravacao(cfg.pasta, caminho, guardadosNome)
      : (resolverVendor(raiz, caminho) ?? resolverEstatico(raiz, caminho));
    if (!r) return naoEncontrado(res);
    servirArquivo(req, res, r);
  }

  const servidor = http.createServer(async (req, res) => {
    try {
      cabecalhosBase(res);
      if (!hostPermitido(req.headers.host, porta, cfg.hostsPermitidos)) {
        return json(res, 421, { ok: false, erro: 'Host não permitido.' });
      }
      const recusa = recusaTailscale(req.headers, cfg.tailscaleLoginsPermitidos, porta);
      if (recusa) return json(res, 403, { ok: false, erro: recusa });
      for (const fn of antes) {
        if (!(await fn(req, res))) return;
      }
      await rotear(req, res);
    } catch (e) {
      log(`Erro no servidor: ${e.message}`);
      if (!res.headersSent) json(res, 500, { ok: false, erro: 'Erro interno.' });
      else res.destroy();
    }
  });
  servidor.on('clientError', (_e, socket) => { try { socket.destroy(); } catch { /* ignora */ } });

  return {
    /** Escuta só em 127.0.0.1. Devolve a porta (útil com 0). */
    listen(p) {
      return new Promise((resolve, reject) => {
        servidor.once('error', reject);
        servidor.listen(p, '127.0.0.1', () => {
          servidor.off('error', reject);
          porta = servidor.address().port;
          resolve(porta);
        });
      });
    },
    async fechar() {
      aoVivo.fechar();
      ouvirSite.fechar();
      await new Promise((r) => { servidor.close(() => r()); servidor.closeAllConnections?.(); });
    },
    porta: () => porta,
    ouvirSite,
  };
}
