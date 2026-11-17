import { spawn as spawnPadrao } from 'node:child_process';
import { json } from './seguranca.js';

export function argsMp3(cfg) {
  return [
    '-hide_banner', '-loglevel', 'error',
    '-f', 's16le', '-ar', String(cfg.ouvirHz ?? 16000), '-ac', '1', '-i', 'pipe:0',
    '-c:a', 'libmp3lame', '-b:a', String(cfg.ouvirMp3Bitrate ?? '32k'),
    '-f', 'mp3', '-flush_packets', '1', 'pipe:1',
  ];
}

/**
 * "Ouvir no site": PCM direto do distribuidor, ou MP3 de UM ffmpeg
 * compartilhado (liga com o primeiro ouvinte, desliga com o último).
 * Ouvinte lento perde blocos em vez de acumular memória.
 */
export function criarOuvirSite({ cfg, distribuidor, spawn = spawnPadrao, log = () => {} }) {
  const max = cfg.ouvirSiteMax ?? 4;
  const pcm = new Set();
  const mp3 = new Set();
  let proc = null;
  let soltarEntrada = null;

  function pararCodificador() {
    const p = proc;
    if (!p) return;
    proc = null;
    soltarEntrada?.(); soltarEntrada = null;
    try { p.stdin?.end(); } catch { /* ignora */ }
    try { p.kill(); } catch { /* ignora */ }
  }

  function iniciarCodificador() {
    const p = spawn(cfg.ffmpeg ?? 'ffmpeg', argsMp3(cfg), { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
    proc = p;
    p.stdin?.on?.('error', () => {});
    soltarEntrada = distribuidor.ligarEscrita(p.stdin);
    p.stdout?.on?.('data', (b) => {
      for (const res of mp3) { if (!res.writableNeedDrain) res.write(b); }
    });
    const cair = (motivo) => {
      if (proc !== p) return;
      log(`Codificador MP3 encerrou (${motivo}).`);
      pararCodificador();
      for (const res of [...mp3]) res.end();
      mp3.clear();
    };
    p.on('error', (e) => cair(e.message));
    p.on('exit', () => cair('saiu'));
  }

  function entrar(conjunto, res) {
    conjunto.add(res);
    let saiu = false;
    return (aoSair) => {
      const sair = () => { if (saiu) return; saiu = true; conjunto.delete(res); aoSair?.(); };
      res.on('close', sair);
      res.on('error', sair);
    };
  }

  return {
    ouvintes: () => ({ pcm: pcm.size, mp3: mp3.size }),
    codificadorAtivo: () => proc !== null,

    pcm(req, res) {
      if (pcm.size >= max) return json(res, 503, { ok: false, erro: 'Ouvintes demais no momento.' });
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'X-Taxa': String(cfg.ouvirHz),
        'Cache-Control': 'no-store, no-transform',
      });
      res.flushHeaders?.();
      const soltar = distribuidor.ligarEscrita(res);
      entrar(pcm, res)(soltar);
    },

    mp3(req, res) {
      if (mp3.size >= max) return json(res, 503, { ok: false, erro: 'Ouvintes demais no momento.' });
      if (!proc) {
        try { iniciarCodificador(); } catch (e) {
          proc = null;
          return json(res, 503, { ok: false, erro: 'Codificador de áudio indisponível.' });
        }
      }
      res.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store, no-transform',
      });
      res.flushHeaders?.();
      entrar(mp3, res)(() => { if (mp3.size === 0) pararCodificador(); });
    },

    fechar() {
      for (const res of [...pcm, ...mp3]) res.end();
      pcm.clear(); mp3.clear();
      pararCodificador();
    },
  };
}
