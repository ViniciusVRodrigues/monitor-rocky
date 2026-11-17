import http from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
import { criarDistribuidor } from '../src/distribuidor.js';
import { criarServidor } from '../src/servidor/app.js';

export function monitorFalso({ estado = 'gravando', demoraMs = 0 } = {}) {
  let atual = estado;
  let ouvindo = false;
  const ouvintes = new Set();
  const mudar = async (n) => {
    if (demoraMs) await new Promise((r) => setTimeout(r, demoraMs));
    atual = n; for (const f of ouvintes) f(n); return n;
  };
  return {
    gravador: {
      estado: () => atual,
      iniciar: () => mudar('gravando'),
      parar: () => mudar('parado'),
      camera: (v) => mudar(v === 'desligar' ? 'so-som' : 'gravando'),
      aoMudar: (f) => { ouvintes.add(f); return () => ouvintes.delete(f); },
    },
    distribuidor: criarDistribuidor(),
    ouvinte: { ativo: () => ouvindo, ligar: () => { ouvindo = true; }, desligar: async () => { ouvindo = false; } },
  };
}

export function procFalso() {
  const p = new EventEmitter();
  p.recebidos = [];
  p.stdin = new EventEmitter();
  p.stdin.write = (b) => { p.recebidos.push(b); return true; };
  p.stdin.end = () => {};
  p.stdout = new EventEmitter();
  p.matou = false;
  p.kill = () => { p.matou = true; setImmediate(() => p.emit('exit', null, 'SIGTERM')); };
  return p;
}

export async function cenario({ cfg = {}, monitor = monitorFalso(), antes = [], spawn, aoEvento, agora } = {}) {
  const raiz = mkdtempSync(join(tmpdir(), 'rocky-srv-'));
  const pasta = join(raiz, 'gravacoes');
  mkdirSync(join(raiz, 'web', 'js'), { recursive: true });
  writeFileSync(join(raiz, 'web', 'index.html'), '<h1>oi</h1>');
  writeFileSync(join(raiz, 'web', 'js', 'app.js'), 'x');
  writeFileSync(join(raiz, 'web', 'segredo.txt'), 'nao');
  mkdirSync(pasta, { recursive: true });
  const c = {
    pasta, ouvirHz: 16000, trechoSegundos: 60, bufferHoras: 4, aovivoSegundos: 2, aovivoSegmentos: 6,
    sseBatidaSegundos: 15, ouvirSiteMax: 4, ouvirMp3Bitrate: '32k', ffmpeg: 'ffmpeg',
    controleTempoLimiteSegundos: 20, nivelHz: 10, nivelSuavizacao: 0.6, nivelPisoDb: -60, hostsPermitidos: ['rocky.exemplo.test'],
    ...cfg,
  };
  const servidor = criarServidor({ cfg: c, raiz, monitor, antes, spawn, aoEvento, agora });
  const porta = await servidor.listen(0);
  function req(caminho, { metodo = 'GET', headers = {}, corpo } = {}) {
    return new Promise((resolve, reject) => {
      const r = http.request({ host: '127.0.0.1', port: porta, path: caminho, method: metodo, headers: { Host: `127.0.0.1:${porta}`, ...headers } }, (res) => {
        const partes = [];
        res.on('data', (b) => partes.push(b));
        res.on('end', () => {
          const buf = Buffer.concat(partes);
          let json; try { json = JSON.parse(buf.toString('utf8')); } catch { /* não é json */ }
          resolve({ status: res.statusCode, headers: res.headers, buf, texto: buf.toString('utf8'), json });
        });
      });
      r.on('error', reject);
      if (corpo !== undefined) r.write(corpo);
      r.end();
    });
  }
  const postar = (acao, extra = {}) => req('/api/controle', {
    metodo: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Rocky': '1', ...extra },
    corpo: typeof acao === 'string' ? JSON.stringify({ acao }) : JSON.stringify(acao),
  });
  /** Abre um fluxo e devolve { res, texto(), fechar() }. */
  function fluxo(caminho, headers = {}) {
    return new Promise((resolve, reject) => {
      const r = http.request({ host: '127.0.0.1', port: porta, path: caminho, headers: { Host: `127.0.0.1:${porta}`, ...headers } }, (res) => {
        const partes = [];
        res.on('data', (b) => partes.push(b));
        resolve({
          res, status: res.statusCode, partes,
          buf: () => Buffer.concat(partes),
          texto: () => Buffer.concat(partes).toString('utf8'),
          fechar: () => r.destroy(),
        });
      });
      r.on('error', (e) => { if (e.code !== 'ECONNRESET') reject(e); });
      r.end();
    });
  }
  return {
    raiz, pasta, porta, monitor, servidor, req, postar, fluxo,
    async fim() { await servidor.fechar(); rmSync(raiz, { recursive: true, force: true }); },
  };
}

export const esperar = async (cond, ms = 2000) => {
  const t = Date.now();
  while (!cond()) {
    if (Date.now() - t > ms) throw new Error('tempo esgotado esperando condição');
    await new Promise((r) => setTimeout(r, 10));
  }
};
