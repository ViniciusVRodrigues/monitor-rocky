import { spawn } from 'node:child_process';

const pausar = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Mantém um processo rodando: se sair sem ter sido pedido, reinicia com
 * espera crescente (dobra a cada queda, até `esperaMaxMs`). A espera volta ao
 * início se o processo ficou de pé por `estavelMs`.
 *
 * - `args` pode ser uma lista ou uma função (chamada a cada partida, para
 *   refletir o estado atual).
 * - `aoSaida(buffer)` recebe o stdout; ele é SEMPRE consumido (mesmo sem
 *   ninguém ouvindo), senão o processo trava com o pipe cheio.
 * - `reiniciar()` encerra o processo e sobe outro sem passar pelo backoff.
 * - `definirAtivo(false)` encerra e não reinicia; `definirAtivo(true)` volta.
 * - `intervaloMinimoMs`: espaço mínimo entre duas partidas (evita que dois
 *   processos criem o mesmo arquivo HH-MM-SS).
 */
export function supervisionar({
  comando,
  args,
  opcoes = {},
  antesDeIniciar = () => {},
  aoSaida = () => {},
  ativoInicial = true,
  log = console.log,
  esperaInicialMs = 1000,
  esperaMaxMs = 60000,
  estavelMs = 30000,
  esperarSaidaMs = 8000,
  intervaloMinimoMs = 1100,
  iniciarProcesso = (cmd, a, o) => spawn(cmd, a, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, ...o }),
  esperar = pausar,
  relogio = Date.now,
  prefixoLog = 'ffmpeg',
  encerrarProcesso = null,
}) {
  let parando = false;
  let ativo = ativoInicial;
  let filho = null;
  let paradaPedida = false;
  let acorda = null;
  let ultimoInicio = null;
  let espera = esperaInicialMs;

  const acordar = () => { const a = acorda; acorda = null; a?.(); };
  const dormirAte = () => new Promise((r) => { acorda = r; });

  async function encerrar(f) {
    if (encerrarProcesso) return encerrarProcesso(f);
    const saiu = new Promise((r) => f.once('exit', r));
    try { f.stdin?.write('q'); } catch { /* já fechou */ }
    const t = setTimeout(() => { try { f.kill(); } catch { /* ignora */ } }, esperarSaidaMs);
    await saiu;
    clearTimeout(t);
  }

  const terminou = (async () => {
    while (!parando) {
      if (!ativo) { await dormirAte(); continue; }
      if (ultimoInicio !== null) {
        const falta = intervaloMinimoMs - (relogio() - ultimoInicio);
        if (falta > 0) await esperar(falta);
        if (parando || !ativo) continue;
      }
      try { antesDeIniciar(); } catch (e) { log(`Falha ao preparar a partida: ${e.message}`); }
      const inicio = relogio();
      ultimoInicio = inicio;
      log(`Iniciando ${comando}...`);
      const resultado = await new Promise((resolve) => {
        let f;
        try { f = iniciarProcesso(comando, typeof args === 'function' ? args() : args, opcoes); }
        catch (e) { resolve({ erro: e }); return; }
        filho = f;
        f.on('error', (e) => resolve({ erro: e }));
        f.on('exit', (codigo, sinal) => resolve({ codigo, sinal }));
        f.stdout?.on('data', (b) => { try { aoSaida(b); } catch (e) { log(`Erro ao tratar a saída: ${e.message}`); } });
        f.stderr?.on('data', (b) => {
          for (const l of String(b).split(/\r?\n/)) if (l.trim()) log(`[${prefixoLog}] ${l}`);
        });
      });
      filho = null;
      if (parando) break;
      if (paradaPedida) { paradaPedida = false; espera = esperaInicialMs; continue; }
      if (relogio() - inicio >= estavelMs) espera = esperaInicialMs;
      const motivo = resultado.erro
        ? `erro ao executar: ${resultado.erro.message}`
        : `saiu com código ${resultado.codigo}${resultado.sinal ? ` (sinal ${resultado.sinal})` : ''}`;
      log(`${comando} ${motivo}. Reiniciando em ${Math.round(espera / 1000)} s.`);
      await Promise.race([esperar(espera), dormirAte()]);
      espera = Math.min(espera * 2, esperaMaxMs);
    }
  })();

  return {
    async parar() {
      parando = true;
      acordar();
      if (filho) await encerrar(filho);
      await terminou;
    },
    async reiniciar() {
      if (filho) { paradaPedida = true; await encerrar(filho); }
      else acordar();
    },
    async definirAtivo(valor) {
      ativo = Boolean(valor);
      if (!ativo && filho) { paradaPedida = true; await encerrar(filho); }
      else acordar();
    },
    ativo: () => ativo,
  };
}
