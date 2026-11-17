import { mkdirSync, appendFileSync, statSync, renameSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Log em arquivo com rotação por tamanho: `nome` vira `nome.1`, `nome.1` vira
 * `nome.2`... e o que passar de `arquivos` antigos é apagado. Nunca lança:
 * falha de disco no log não pode derrubar o monitor.
 */
export function criarLogRotativo({ pasta, nome = 'monitor.log', maxBytes = 5 * 1024 * 1024, arquivos = 5 }) {
  const caminho = join(pasta, nome);
  let tamanho = null;

  function rotacionar() {
    rmSync(`${caminho}.${arquivos}`, { force: true });
    for (let i = arquivos - 1; i >= 1; i--) {
      if (existsSync(`${caminho}.${i}`)) renameSync(`${caminho}.${i}`, `${caminho}.${i + 1}`);
    }
    if (arquivos >= 1) renameSync(caminho, `${caminho}.1`);
    else rmSync(caminho, { force: true });
    tamanho = 0;
  }

  return {
    caminho,
    escrever(linha) {
      try {
        mkdirSync(pasta, { recursive: true });
        if (tamanho === null) { try { tamanho = statSync(caminho).size; } catch { tamanho = 0; } }
        const texto = `${linha}\n`;
        const bytes = Buffer.byteLength(texto);
        if (tamanho > 0 && tamanho + bytes > maxBytes) rotacionar();
        appendFileSync(caminho, texto);
        tamanho += bytes;
      } catch { /* log é auxiliar */ }
    },
  };
}
