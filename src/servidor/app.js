import http from 'node:http';
import { cabecalhosBase, hostPermitido, leituraPermitida, controlePermitido, json, naoEncontrado } from './seguranca.js';
import { resolverGravacao, resolverEstatico, resolverVendor, servirArquivo } from './arquivos.js';
import { listarDias, lerDia, diaValido } from './linha-tempo.js';
import { executarControle, ControleErro, estadoAtual } from './controle.js';
import { criarAoVivo } from './ao-vivo.js';
import { criarOuvirSite } from './ouvir-site.js';

const MAX_CORPO = 1024;

/** ISO 8601 com o deslocamento local (ex.: 2026-11-17T14:03:05-03:00). */
export function isoLocal(d = new Date()) {
  const p = (n, t = 2) => String(n).padStart(t, '0');
  const off = -d.getTimezoneOffset();
  const sinal = off >= 0 ? '+' : '-';
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}` +
    `${sinal}${p(Math.floor(Math.abs(off) / 60))}:${p(Math.abs(off) % 60)}`;
}

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    const partes = []; let total = 0;
    req.on('data', (b) => {
      total += b.length;
      if (total > MAX_CORPO) { reject(new ControleErro(413, 'Pedido grande demais.')); req.destroy(); return; }
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
export function criarServidor({ cfg, raiz, monitor, aoEvento, antes = [], spawn, log = () => {}, agora = () => new Date() }) {
  const ouvirSite = criarOuvirSite({ cfg, distribuidor: monitor.distribuidor, spawn, log });
  const aoVivo = criarAoVivo({ cfg, monitor, aoEvento });
  let porta = 0;

  const apiConfig = () => ({
    ouvirModo: cfg.ouvirModo ?? 'auto', ouvirHz: cfg.ouvirHz, ouvirFolgaMs: cfg.ouvirFolgaMs ?? 300,
    ouvirAtrasoMaxMs: cfg.ouvirAtrasoMaxMs ?? 1000, ouvirMp3AtrasoMaxSegundos: cfg.ouvirMp3AtrasoMaxSegundos ?? 4,
    linhaTempoAtualizarSegundos: cfg.linhaTempoAtualizarSegundos ?? 30,
    bufferHoras: cfg.bufferHoras, trechoSegundos: cfg.trechoSegundos,
    aovivoSegundos: cfg.aovivoSegundos, aovivoSegmentos: cfg.aovivoSegmentos,
    controleTempoLimiteSegundos: cfg.controleTempoLimiteSegundos ?? 20,
    somAoAbrir: cfg.somAoAbrir ?? true, nivelHz: cfg.nivelHz ?? 10,
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

  async function rotear(req, res) {
    const url = req.url ?? '/';
    if (!url.startsWith('/')) return naoEncontrado(res);
    const caminho = url.split('?')[0].split('#')[0];

    if (caminho === '/api/controle') {
      if (req.method !== 'POST') return json(res, 405, { ok: false, erro: 'Método não permitido.' }, { Allow: 'POST' });
      return controle(req, res);
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

    const r = ehFluxo ? resolverGravacao(cfg.pasta, caminho)
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
