// Controle do monitor em execução: npm run iniciar | parar | estado | camera -- desligar|ligar | ouvir -- ligar|desligar
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { carregarConfig, ConfigErro } from '../src/config.js';
import { enviarComando, SemMonitorErro } from '../src/canal.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const [cmd, valor] = process.argv.slice(2);
const USO = 'Uso: npm run iniciar | parar | estado | camera -- desligar|ligar | ouvir -- ligar|desligar';

const TEXTOS = {
  gravando: 'gravando (câmera e som)',
  'so-som': 'só o som (câmera liberada)',
  parado: 'parado',
};

try {
  if (!['iniciar', 'parar', 'estado', 'camera', 'ouvir'].includes(cmd)) { console.error(USO); process.exit(2); }
  if (['camera', 'ouvir'].includes(cmd) && !['ligar', 'desligar'].includes(valor)) { console.error(USO); process.exit(2); }
  const cfg = carregarConfig(raiz);
  const r = await enviarComando(cfg.canalControle, { cmd, valor });
  if (!r.ok) { console.error(r.erro); process.exit(1); }
  console.log(`Estado: ${TEXTOS[r.estado] ?? r.estado}. Ouvir no PC: ${r.ouvindo ? 'ligado' : 'desligado'}.`);
} catch (e) {
  console.error(e instanceof ConfigErro || e instanceof SemMonitorErro ? e.message : `Falhou: ${e.message}`);
  process.exit(1);
}
