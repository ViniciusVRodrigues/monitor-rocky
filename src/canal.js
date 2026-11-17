import net from 'node:net';
import { rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export class SemMonitorErro extends Error {}

/**
 * Canal de controle local: pipe nomeado no Windows (`\\.\pipe\<nome>`) e
 * socket unix na pasta temporária nos outros sistemas. Nada de porta TCP:
 * não é alcançável pela rede nem por páginas do navegador.
 * Protocolo: uma linha JSON por pedido e uma por resposta.
 */
function caminho(nome) {
  return process.platform === 'win32' ? `\\\\.\\pipe\\${nome}` : join(tmpdir(), `${nome}.sock`);
}

export async function servirCanal({ nome, gravador, ouvinte }) {
  const caminhoCanal = caminho(nome);
  if (process.platform !== 'win32' && existsSync(caminhoCanal)) rmSync(caminhoCanal, { force: true });

  async function tratar(pedido) {
    switch (pedido.cmd) {
      case 'estado': break;
      case 'iniciar': await gravador.iniciar(); break;
      case 'parar': await gravador.parar(); break;
      case 'camera': await gravador.camera(pedido.valor); break;
      case 'ouvir':
        if (pedido.valor === 'ligar') ouvinte.ligar();
        else if (pedido.valor === 'desligar') await ouvinte.desligar();
        else throw new Error('Use "ligar" ou "desligar".');
        break;
      default: throw new Error(`Comando desconhecido: ${pedido.cmd}`);
    }
    return { ok: true, estado: gravador.estado(), ouvindo: ouvinte.ativo() };
  }

  const servidor = net.createServer((socket) => {
    let buf = '';
    socket.on('error', () => {});
    socket.on('data', async (d) => {
      buf += d;
      const i = buf.indexOf('\n');
      if (i < 0) return;
      const linha = buf.slice(0, i);
      buf = buf.slice(i + 1);
      let resposta;
      try { resposta = await tratar(JSON.parse(linha)); }
      catch (e) { resposta = { ok: false, erro: e.message }; }
      socket.end(`${JSON.stringify(resposta)}\n`);
    });
  });
  await new Promise((resolve, reject) => {
    servidor.once('error', reject);
    servidor.listen(caminhoCanal, resolve);
  });
  return {
    fechar: () => new Promise((r) => servidor.close(() => {
      if (process.platform !== 'win32') rmSync(caminhoCanal, { force: true });
      r();
    })),
  };
}

export function enviarComando(nome, pedido, { tempoMs = 20000 } = {}) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(caminho(nome));
    let buf = '';
    const t = setTimeout(() => { socket.destroy(); reject(new Error('O monitor não respondeu a tempo.')); }, tempoMs);
    socket.on('connect', () => socket.write(`${JSON.stringify(pedido)}\n`));
    socket.on('data', (d) => { buf += d; });
    socket.on('end', () => {
      clearTimeout(t);
      try { resolve(JSON.parse(buf)); } catch { reject(new Error('Resposta inválida do monitor.')); }
    });
    socket.on('error', (e) => {
      clearTimeout(t);
      if (['ENOENT', 'ECONNREFUSED'].includes(e.code)) reject(new SemMonitorErro('O monitor não está rodando. Abra outro terminal e rode "npm start".'));
      else reject(e);
    });
  });
}
