import { mkdirSync, statSync, renameSync, rmSync, existsSync } from 'node:fs';
import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Log em arquivo com rotação por tamanho: `nome` vira `nome.1`, `nome.1` vira
 * `nome.2`... e o que passar de `arquivos` antigos é apagado. Nunca lança:
 * falha de disco no log não pode derrubar o monitor.
 */
export function criarLogRotativo({ pasta, nome = 'monitor.log', maxBytes = 5 * 1024 * 1024, arquivos = 5, filaMaxBytes = 1024 * 1024 }) {
  const caminho = join(pasta, nome);
  let tamanho = null;
  let fila = [];
  let filaBytes = 0;
  let descartados = 0;
  let gravando = null;

  // A rotação é síncrona (rara); a escrita comum é append assíncrono.
  function rotacionar() {
    rmSync(`${caminho}.${arquivos}`, { force: true });
    for (let i = arquivos - 1; i >= 1; i--) {
      if (existsSync(`${caminho}.${i}`)) renameSync(`${caminho}.${i}`, `${caminho}.${i + 1}`);
    }
    if (arquivos >= 1) renameSync(caminho, `${caminho}.1`);
    else rmSync(caminho, { force: true });
    tamanho = 0;
  }

  async function drenar() {
    while (fila.length) {
      if (descartados > 0) {
        const kb = Math.max(1, Math.round(descartados / 1024));
        descartados = 0;
        fila.unshift(`${new Date().toLocaleString('pt-BR')} ${kb} KB de log descartados\n`);
      }
      const texto = fila.join('');
      fila = []; filaBytes = 0;
      try {
        mkdirSync(pasta, { recursive: true });
        if (tamanho === null) { try { tamanho = statSync(caminho).size; } catch { tamanho = 0; } }
        const bytes = Buffer.byteLength(texto);
        if (tamanho > 0 && tamanho + bytes > maxBytes) rotacionar();
        await appendFile(caminho, texto);
        tamanho += bytes;
      } catch { /* log é auxiliar */ }
    }
  }

  function disparar() {
    if (!gravando) gravando = new Promise((r) => setImmediate(r)).then(drenar).finally(() => { gravando = null; });
    return gravando;
  }

  return {
    caminho,
    escrever(linha) {
      const texto = `${linha}\n`;
      const bytes = Buffer.byteLength(texto);
      if (filaBytes + bytes > filaMaxBytes) { descartados += bytes; return; }
      fila.push(texto); filaBytes += bytes;
      disparar();
    },
    /** Espera a fila esvaziar (para testes e para encerrar). */
    async aguardar() {
      while (gravando || fila.length) await disparar();
    },
  };
}
