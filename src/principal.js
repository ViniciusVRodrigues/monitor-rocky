import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { carregarConfig, ConfigErro } from './config.js';
import { iniciarMonitor } from './captura.js';
import { criarServidor } from './servidor/app.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const log = (m) => console.log(`${new Date().toLocaleString('pt-BR')} ${m}`);

/**
 * `npm start`: sobe o monitor (e a detecção, se o ROCKY-2 estiver presente: o
 * `iniciarMonitor` a liga sozinho) e o servidor HTTP local com a página.
 */
async function main() {
  const cfg = carregarConfig(raiz);
  const monitor = await iniciarMonitor(cfg);
  const det = monitor.deteccao;
  const aoEvento = det?.aoEvento ? det.aoEvento.bind(det) : undefined;
  const servidor = criarServidor({ cfg, raiz, monitor, aoEvento, log });
  let porta;
  try { porta = await servidor.listen(cfg.servidorPorta); }
  catch (e) {
    await monitor.parar();
    throw new Error(`Não consegui abrir a porta ${cfg.servidorPorta} (já há um servidor rodando?): ${e.message}`);
  }
  log(`Monitor no ar: estado "${monitor.gravador.estado()}". Página em http://127.0.0.1:${porta}/ . Ctrl+C para encerrar.`);

  let saindo = false;
  const sair = async () => {
    if (saindo) return;
    saindo = true;
    log('Encerrando...');
    await servidor.fechar();
    await monitor.parar();
    process.exit(0);
  };
  process.on('SIGINT', sair);
  process.on('SIGTERM', sair);
}

main().catch((e) => {
  console.error(e instanceof ConfigErro ? e.message : `Erro: ${e.message}`);
  process.exit(1);
});
