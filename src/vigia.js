import { spawn } from 'node:child_process';
import { writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { carregarConfig, ConfigErro } from './config.js';
import { supervisionar } from './supervisor.js';
import { criarLogRotativo } from './log-rotativo.js';
import { criarSaude } from './saude.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Vigia: mantém o monitor (processo Node) rodando. Se ele cair, sobe de novo
 * com espera crescente (usa `supervisionar`). Cada linha que o monitor escreve
 * vai para `log` e para `aoLinha` (a saúde usa para contar falhas do ffmpeg).
 * Aceita as mesmas opções de `supervisionar` (processo falso nos testes).
 */
export function vigiar({ log = console.log, aoLinha = () => {}, ...opcoes }) {
  let resto = '';
  const aoSaida = (b) => {
    resto += String(b);
    const linhas = resto.split(/\r?\n/);
    resto = linhas.pop();
    for (const l of linhas) {
      if (!l.trim()) continue;
      log(l);
      try { aoLinha(l); } catch (e) { log(`Erro ao tratar a linha: ${e.message}`); }
    }
  };
  return supervisionar({ prefixoLog: 'monitor', ...opcoes, aoSaida, log });
}

/** Encerra o monitor e o ffmpeg dele (a árvore toda) no Windows. */
function encerrarArvore(f) {
  return new Promise((resolve) => {
    f.once('exit', resolve);
    if (process.platform === 'win32' && f.pid) {
      const t = spawn('taskkill', ['/PID', String(f.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
      t.on('error', () => { try { f.kill(); } catch { /* já saiu */ } });
    } else {
      try { f.kill(); } catch { /* já saiu */ }
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const cfg = carregarConfig(raiz);
    const arquivoLog = criarLogRotativo({
      pasta: cfg.logPasta ?? join(raiz, 'logs'),
      maxBytes: (cfg.logMaxMB ?? 5) * 1024 * 1024,
      arquivos: cfg.logArquivos ?? 5,
    });
    const log = (m) => {
      const linha = /^\d{2}\/\d{2}\/\d{4}/.test(m) ? m : `${new Date().toLocaleString('pt-BR')} ${m}`;
      arquivoLog.escrever(linha);
      console.log(linha);
    };
    // Gancho para o ROCKY-6 (avisos no celular): passe `aoAlerta` aqui (recebe { tipo, problema, mensagem, em }).
    const saude = criarSaude({ cfg, log, toast: cfg.alertaToast !== false, aoAlerta: () => {} });
    const arquivoPid = join(cfg.logPasta ?? join(raiz, 'logs'), 'vigia.pid');
    mkdirSync(dirname(arquivoPid), { recursive: true });
    writeFileSync(arquivoPid, String(process.pid));
    const timerSaude = setInterval(() => saude.verificar().catch(() => {}), (cfg.saudeIntervaloSegundos ?? 60) * 1000);
    const v = vigiar({
      comando: process.execPath,
      args: [join(raiz, 'src', 'captura.js')],
      opcoes: { cwd: raiz },
      log,
      aoLinha: (l) => saude.registrarLinha(l),
      esperaInicialMs: (cfg.vigiaEsperaSegundos ?? 2) * 1000,
      esperaMaxMs: (cfg.vigiaEsperaMaxSegundos ?? 120) * 1000,
      estavelMs: (cfg.vigiaEstavelSegundos ?? 60) * 1000,
      encerrarProcesso: encerrarArvore,
    });
    log(`Vigia no ar. Log em ${arquivoLog.caminho}.`);
    let saindo = false;
    const sair = async () => {
      if (saindo) return;
      saindo = true;
      clearInterval(timerSaude);
      rmSync(arquivoPid, { force: true });
      log('Vigia encerrando...');
      await v.parar();
      process.exit(0);
    };
    process.on('SIGINT', sair);
    process.on('SIGTERM', sair);
  } catch (e) {
    console.error(e instanceof ConfigErro ? e.message : e.message);
    process.exit(1);
  }
}
