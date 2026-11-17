import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { carregarConfig, validarDispositivos, ConfigErro } from './config.js';
import { montarArgs } from './ffmpeg-args.js';
import { supervisionar } from './supervisor.js';
import { garantirPastas, limparTrechos } from './limpeza.js';
import { criarGravador } from './gravador.js';
import { criarDistribuidor } from './distribuidor.js';
import { criarOuvinte } from './ouvir.js';
import { servirCanal } from './canal.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const log = (m) => console.log(`${new Date().toLocaleString('pt-BR')} ${m}`);

/**
 * Inicia o monitor: captura (ffmpeg supervisionado), limpeza do buffer, canal
 * de controle local, distribuidor de áudio e "ouvir no PC".
 *
 * Devolve { gravador, distribuidor, ouvinte, parar } — o ROCKY-2 e o ROCKY-3
 * importam este módulo e usam `gravador` (estado/iniciar/parar/camera) e
 * `distribuidor.inscrever(fn)` (áudio PCM s16le mono em `cfg.ouvirHz`).
 */
export async function iniciarMonitor(cfg, { saidasExtras = [], canal = true } = {}) {
  validarDispositivos(cfg);
  const limpar = () => limparTrechos({ pasta: cfg.pasta, bufferHoras: cfg.bufferHoras, log });
  garantirPastas(cfg.pasta);
  limpar();
  const timer = setInterval(() => { garantirPastas(cfg.pasta); limpar(); }, cfg.limpezaMinutos * 60 * 1000);

  const distribuidor = criarDistribuidor();
  let sup = null;
  const gravador = criarGravador({
    cfg, log,
    supervisor: { reiniciar: () => sup.reiniciar(), definirAtivo: (v) => sup.definirAtivo(v) },
  });
  sup = supervisionar({
    comando: cfg.ffmpeg,
    args: () => montarArgs(cfg, { estado: gravador.estado(), saidasExtras }),
    opcoes: { cwd: cfg.pasta },
    antesDeIniciar: () => garantirPastas(cfg.pasta),
    aoSaida: (b) => distribuidor.publicar(b),
    ativoInicial: gravador.estado() !== 'parado',
    esperaInicialMs: (cfg.esperaReinicioSegundos ?? 1) * 1000,
    esperaMaxMs: (cfg.esperaReinicioMaxSegundos ?? 60) * 1000,
    log,
  });
  const ouvinte = criarOuvinte({ cfg, distribuidor, log });
  let servidor = null;
  if (canal) {
    try { servidor = await servirCanal({ nome: cfg.canalControle, gravador, ouvinte }); }
    catch (e) {
      clearInterval(timer);
      await sup.parar();
      throw new Error(`Não consegui abrir o canal de controle "${cfg.canalControle}" (já há um monitor rodando?): ${e.message}`);
    }
  }
  return {
    gravador, distribuidor, ouvinte,
    async parar() {
      clearInterval(timer);
      await ouvinte.desligar();
      await servidor?.fechar();
      await sup.parar();
    },
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const cfg = carregarConfig(raiz);
    const monitor = await iniciarMonitor(cfg);
    log(`Monitor no ar: estado "${monitor.gravador.estado()}", pasta ${cfg.pasta} (trechos de ${cfg.trechoSegundos} s, buffer de ${cfg.bufferHoras} h). Ctrl+C para encerrar.`);
    let saindo = false;
    const sair = async () => {
      if (saindo) return;
      saindo = true;
      log('Encerrando...');
      await monitor.parar();
      process.exit(0);
    };
    process.on('SIGINT', sair);
    process.on('SIGTERM', sair);
  } catch (e) {
    if (e instanceof ConfigErro) { console.error(e.message); process.exit(1); }
    console.error(e.message);
    process.exit(1);
  }
}
