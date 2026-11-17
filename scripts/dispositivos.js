import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listarDispositivos } from '../src/dispositivos.js';
import { carregarConfig } from '../src/config.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
let ffmpeg = 'ffmpeg';
try { ffmpeg = carregarConfig(raiz).ffmpeg ?? 'ffmpeg'; } catch { /* usa o padrão */ }

try {
  const { video, audio } = listarDispositivos(ffmpeg);
  const mostrar = (titulo, lista) => {
    console.log(`\n${titulo}:`);
    if (!lista.length) console.log('  (nenhum encontrado)');
    for (const nome of lista) console.log(`  "${nome}"`);
  };
  mostrar('Câmeras (vídeo)', video);
  mostrar('Microfones (áudio)', audio);
  console.log('\nCopie os nomes exatos (com os espaços) para "video" e "audio" em config.local.json.');
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
