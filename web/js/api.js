// Acesso à API do servidor: fetch com erros em pt-BR e SSE com reconexão.

export async function pegarJson(url, { sinal } = {}) {
  const r = await fetch(url, { cache: 'no-store', signal: sinal });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export const pegarConfig = () => pegarJson('/api/config');
export const pegarEstado = () => pegarJson('/api/estado');
export const pegarDias = () => pegarJson('/api/dias');
export const pegarDia = (dia) => pegarJson(`/api/dia/${encodeURIComponent(dia)}`);

export const pegarGuardados = () => pegarJson('/api/guardados');

/**
 * POST JSON com X-Rocky. Resolve com { ok, status, ...corpo } ou { ok: false, status, erro }.
 * Nunca rejeita: falha de rede ou tempo esgotado voltam com ok:false e `erro` em pt-BR.
 */
export async function postarJson(url, corpoEnvio, tempoLimiteSegundos) {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), tempoLimiteSegundos * 1000);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Rocky': '1' },
      body: JSON.stringify(corpoEnvio),
      signal: abort.signal,
    });
    let corpo = {};
    try { corpo = await r.json(); } catch { /* corpo vazio */ }
    if (r.ok && corpo.ok !== false) return { ok: true, status: r.status, ...corpo };
    // O corpo segue junto: um apagar parcial (200 com ok:false) traz as contagens.
    return { ...corpo, ok: false, status: r.status, erro: corpo.erro || 'O monitor não aceitou o pedido.' };
  } catch (e) {
    const tempo = e?.name === 'AbortError';
    return { ok: false, status: 0, erro: tempo ? 'O monitor não respondeu a tempo.' : 'Sem conexão com o monitor.' };
  } finally {
    clearTimeout(timer);
  }
}

/** POST /api/controle. Resolve com { ok, status, estado, ouvindoPC, erro }; nunca rejeita. */
export const enviarControle = (acao, tempoLimiteSegundos) => postarJson('/api/controle', { acao }, tempoLimiteSegundos);

/**
 * Abre o SSE /api/ao-vivo. Reconecta sozinho (backoff até 10 s).
 * Ganchos: aoEstado(dados), aoEvento(dados), aoNivel(numero), aoConexao(bool).
 */
export function abrirAoVivo({ aoEstado, aoEvento, aoNivel, aoConexao }) {
  let fonte = null;
  let timer = null;
  let espera = 1000;
  let fechado = false;

  const lerJson = (texto) => { try { return JSON.parse(texto); } catch { return null; } };

  function conectar() {
    if (fechado) return;
    fonte = new EventSource('/api/ao-vivo');
    fonte.addEventListener('open', () => { espera = 1000; aoConexao(true); });
    fonte.addEventListener('estado', (e) => { const d = lerJson(e.data); if (d) { aoConexao(true); aoEstado(d); } });
    fonte.addEventListener('evento', (e) => { const d = lerJson(e.data); if (d) aoEvento(d); });
    fonte.addEventListener('nivel', (e) => { const d = lerJson(e.data); if (d && typeof d.nivel === 'number') aoNivel(d.nivel); });
    fonte.addEventListener('error', () => {
      aoConexao(false);
      if (fonte.readyState === EventSource.CLOSED) {
        fonte.close();
        timer = setTimeout(conectar, espera);
        espera = Math.min(10000, espera * 2);
      }
    });
  }
  conectar();

  return { fechar() { fechado = true; clearTimeout(timer); fonte?.close(); } };
}
