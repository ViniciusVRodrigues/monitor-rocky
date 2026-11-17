import net from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

/**
 * Servidor local que recebe os quadros de movimento do ffmpeg.
 *
 * No Windows é um pipe nomeado (`\\.\pipe\<nome>-<pid>`), que o ffmpeg abre
 * como arquivo de saída; em outros sistemas, um socket unix (`unix:` no
 * ffmpeg). Precisa estar ouvindo ANTES de o ffmpeg partir. Aceita uma conexão
 * por partida do ffmpeg e chama `aoConexao()` em cada uma (para zerar o
 * detector). Os dados são SEMPRE lidos e o handler nunca lança erro: se o
 * Node parasse de ler, o ffmpeg travaria e com ele os trechos e o HLS.
 */
export async function abrirPipeQuadros({ nome, aoConexao = () => {}, aoDados = () => {}, log = () => {} }) {
  const base = `${nome}-${process.pid}`;
  const windows = process.platform === 'win32';
  const caminho = windows ? `\\\\.\\pipe\\${base}` : join(tmpdir(), `${base}.sock`);
  if (!windows) rmSync(caminho, { force: true });
  const conexoes = new Set();

  const servidor = net.createServer((sock) => {
    conexoes.add(sock);
    try { aoConexao(); } catch (e) { log(`Movimento: erro ao reiniciar o detector: ${e.message}`); }
    sock.on('data', (b) => { try { aoDados(b); } catch (e) { log(`Movimento: erro ao analisar quadro: ${e.message}`); } });
    sock.on('error', () => { /* o ffmpeg fechou ou caiu: o supervisor cuida */ });
    sock.on('close', () => conexoes.delete(sock));
  });

  await new Promise((resolve, reject) => {
    servidor.once('error', reject);
    servidor.listen(caminho, () => { servidor.off('error', reject); resolve(); });
  });
  servidor.on('error', (e) => log(`Movimento: erro no pipe de quadros: ${e.message}`));

  return {
    caminho,
    /** Caminho de saída a passar ao ffmpeg. */
    destinoFfmpeg: windows ? caminho : `unix:${caminho}`,
    conexoes: () => conexoes.size,
    async fechar() {
      for (const s of conexoes) s.destroy();
      await new Promise((r) => servidor.close(() => r()));
      if (!windows) rmSync(caminho, { force: true });
    },
  };
}
