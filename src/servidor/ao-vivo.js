import { criarNivel } from './nivel.js';
import { estadoAtual } from './controle.js';
import { normalizarEvento } from './linha-tempo.js';

const LIMITE_FILA = 1024 * 1024;

/**
 * SSE de /api/ao-vivo: estado ao conectar e a cada troca, eventos novos, nível
 * do som e batida. Só se inscreve no distribuidor (para o nível) enquanto há
 * pelo menos um cliente.
 */
export function criarAoVivo({ cfg, monitor, aoEvento }) {
  const clientes = new Set();
  let cancelarPcm = null;
  let timerBatida = null;
  let ultimoOuvindo = monitor.ouvinte.ativo();

  const nivel = criarNivel({
    ouvirHz: cfg.ouvirHz, nivelHz: cfg.nivelHz ?? 10,
    suavizacao: cfg.nivelSuavizacao ?? 0.6, pisoDb: cfg.nivelPisoDb ?? -60,
    aoNivel: (n) => enviar('nivel', { nivel: n }, true),
  });

  function escrever(res, texto, descartavel) {
    if (res.writableNeedDrain && descartavel) return;
    if (res.writableLength > LIMITE_FILA) { res.destroy(); return; }
    res.write(texto);
  }

  function enviar(evento, dados, descartavel = false) {
    const texto = `event: ${evento}\ndata: ${JSON.stringify(dados)}\n\n`;
    for (const res of clientes) escrever(res, texto, descartavel);
  }

  function emitirEstado() {
    const e = estadoAtual(monitor);
    ultimoOuvindo = e.ouvindoPC;
    enviar('estado', e);
  }

  const cancelarMudar = monitor.gravador.aoMudar(() => { nivel.reiniciar(); emitirEstado(); });
  let cancelarEvento = null;
  if (typeof aoEvento === 'function') {
    try {
      const r = aoEvento((ev) => {
        const n = normalizarEvento(cfg.pasta, ev);
        if (n) enviar('evento', n);
      });
      if (typeof r === 'function') cancelarEvento = r;
    } catch { /* detecção com defeito não derruba o servidor */ }
  }

  function ligarRecursos() {
    cancelarPcm = monitor.distribuidor.inscrever((b) => nivel.alimentar(b));
    timerBatida = setInterval(() => {
      for (const res of clientes) escrever(res, ': batida\n\n', true);
      if (monitor.ouvinte.ativo() !== ultimoOuvindo) emitirEstado();
    }, (cfg.sseBatidaSegundos ?? 15) * 1000);
    timerBatida.unref?.();
  }

  function soltarRecursos() {
    cancelarPcm?.(); cancelarPcm = null;
    clearInterval(timerBatida); timerBatida = null;
    nivel.reiniciar();
  }

  return {
    emitirEstado,
    clientes: () => clientes.size,
    atender(req, res) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.write('retry: 3000\n\n');
      clientes.add(res);
      if (clientes.size === 1) ligarRecursos();
      const e = estadoAtual(monitor);
      res.write(`event: estado\ndata: ${JSON.stringify(e)}\n\n`);
      const sair = () => {
        if (!clientes.delete(res)) return;
        if (clientes.size === 0) soltarRecursos();
      };
      req.on('close', sair);
      res.on('close', sair);
      res.on('error', sair);
    },
    fechar() {
      cancelarMudar();
      cancelarEvento?.();
      for (const res of [...clientes]) res.end();
      clientes.clear();
      soltarRecursos();
    },
  };
}
