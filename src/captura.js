import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { carregarConfig, validarDispositivos, ConfigErro } from './config.js';
import { montarArgs } from './ffmpeg-args.js';
import { supervisionar } from './supervisor.js';
import { garantirPastas, limparTrechos } from './limpeza.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const log = (m) => console.log(`${new Date().toLocaleString('pt-BR')} ${m}`);

/** Inicia captura + limpeza. Devolve { parar }. */
export function iniciarCaptura(cfg, { saidasExtras = [] } = {}) {
  validarDispositivos(cfg);
  const args = montarArgs(cfg, { saidasExtras });
  const limpar = () => limparTrechos({ pasta: cfg.pasta, bufferHoras: cfg.bufferHoras, log });

  garantirPastas(cfg.pasta);
  limpar();
  const timer = setInterval(() => { garantirPastas(cfg.pasta); limpar(); }, cfg.limpezaMinutos * 60 * 1000);

  const sup = supervisionar({
    comando: cfg.ffmpeg,
    args,
    opcoes: { cwd: cfg.pasta },
    antesDeIniciar: () => garantirPastas(cfg.pasta),
    log,
  });
  return {
    async parar() {
      clearInterval(timer);
      await sup.parar();
    },
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const cfg = carregarConfig(raiz);
    const captura = iniciarCaptura(cfg);
    log(`Capturando em ${cfg.pasta} (trechos de ${cfg.trechoSegundos} s, buffer de ${cfg.bufferHoras} h). Ctrl+C para parar.`);
    let saindo = false;
    const sair = async () => {
      if (saindo) return;
      saindo = true;
      log('Encerrando...');
      await captura.parar();
      process.exit(0);
    };
    process.on('SIGINT', sair);
    process.on('SIGTERM', sair);
  } catch (e) {
    if (e instanceof ConfigErro) { console.error(e.message); process.exit(1); }
    throw e;
  }
}
