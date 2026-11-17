import { spawn } from 'node:child_process';

/** Argumentos do player (ffplay) para tocar o PCM do pipe com pouco atraso. */
export function argsOuvir(cfg) {
  const ganho = Number(cfg.ouvirPcGanhoDb ?? 0);
  // Ganho + limitador: sem ele um latido alto estoura (clipa) nas caixas.
  const filtro = ganho ? ['-af', `volume=${ganho}dB,alimiter=limit=0.9`] : [];
  return [
    '-nodisp', '-autoexit', '-loglevel', 'quiet',
    '-fflags', 'nobuffer', '-flags', 'low_delay', '-probesize', '32', '-analyzeduration', '0',
    ...filtro,
    ...(cfg.ouvirArgs ?? []),
    '-f', 's16le', '-sample_rate', String(cfg.ouvirHz ?? 16000), '-ch_layout', 'mono',
    '-i', 'pipe:0',
  ];
}

/**
 * "Ouvir no PC": toca o áudio ao vivo nas caixas do computador (dispositivo
 * padrão do Windows — o ffplay não escolhe a saída). Ligar/desligar não mexe
 * na captura.
 */
export function criarOuvinte({
  cfg, distribuidor, log = console.log,
  iniciarProcesso = (cmd, a) => spawn(cmd, a, { stdio: ['pipe', 'ignore', 'ignore'], windowsHide: true }),
}) {
  let proc = null;
  let desligarEscrita = null;

  function soltar() {
    desligarEscrita?.();
    desligarEscrita = null;
    proc = null;
  }

  return {
    ativo: () => proc !== null,
    ligar() {
      if (proc) return;
      const p = iniciarProcesso(cfg.ouvirComando ?? 'ffplay', argsOuvir(cfg));
      proc = p;
      desligarEscrita = distribuidor.ligarEscrita(p.stdin);
      p.on('error', (e) => { log(`Não consegui tocar o áudio (${cfg.ouvirComando}): ${e.message}`); if (proc === p) soltar(); });
      p.on('exit', () => { if (proc === p) { log('Player de áudio encerrou.'); soltar(); } });
    },
    async desligar() {
      const p = proc;
      if (!p) return;
      soltar();
      const saiu = new Promise((r) => p.once('exit', r));
      try { p.stdin?.end(); } catch { /* ignora */ }
      try { p.kill(); } catch { /* ignora */ }
      await saiu;
    },
  };
}
