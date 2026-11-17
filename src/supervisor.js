import { spawn } from 'node:child_process';

const pausar = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Mantém um processo rodando: se sair sem ter sido pedido, reinicia com
 * espera crescente (dobra a cada queda, até `esperaMaxMs`). A espera volta ao
 * início se o processo ficou de pé por `estavelMs`.
 */
export function supervisionar({
  comando,
  args,
  opcoes = {},
  antesDeIniciar = () => {},
  log = console.log,
  esperaInicialMs = 1000,
  esperaMaxMs = 60000,
  estavelMs = 30000,
  esperarSaidaMs = 8000,
  iniciarProcesso = (cmd, a, o) => spawn(cmd, a, { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true, ...o }),
  esperar = pausar,
  relogio = Date.now,
}) {
  let parando = false;
  let filho = null;
  let espera = esperaInicialMs;
  const terminou = (async () => {
    while (!parando) {
      try { antesDeIniciar(); } catch (e) { log(`Falha ao preparar a partida: ${e.message}`); }
      const inicio = relogio();
      log(`Iniciando ${comando}...`);
      const resultado = await new Promise((resolve) => {
        let f;
        try { f = iniciarProcesso(comando, args, opcoes); }
        catch (e) { resolve({ erro: e }); return; }
        filho = f;
        f.on('error', (e) => resolve({ erro: e }));
        f.on('exit', (codigo, sinal) => resolve({ codigo, sinal }));
        f.stderr?.on('data', (b) => {
          for (const l of String(b).split(/\r?\n/)) if (l.trim()) log(`[ffmpeg] ${l}`);
        });
      });
      filho = null;
      if (parando) break;
      if (relogio() - inicio >= estavelMs) espera = esperaInicialMs;
      const motivo = resultado.erro
        ? `erro ao executar: ${resultado.erro.message}`
        : `saiu com código ${resultado.codigo}${resultado.sinal ? ` (sinal ${resultado.sinal})` : ''}`;
      log(`${comando} ${motivo}. Reiniciando em ${Math.round(espera / 1000)} s.`);
      await esperar(espera);
      espera = Math.min(espera * 2, esperaMaxMs);
    }
  })();

  return {
    async parar() {
      parando = true;
      const f = filho;
      if (f) {
        const saiu = new Promise((r) => f.once('exit', r));
        try { f.stdin?.write('q'); } catch { /* já fechou */ }
        const t = setTimeout(() => { try { f.kill(); } catch { /* ignora */ } }, esperarSaidaMs);
        await saiu;
        clearTimeout(t);
      }
      await terminou;
    },
  };
}
