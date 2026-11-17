// Funções puras da linha do tempo (sem DOM): testáveis em node.

export const FOLGA_CONTIGUO_SEGUNDOS = 5;

const dois = (n) => String(n).padStart(2, '0');

/** "HH:MM:SS" → segundos desde 00:00. */
export function segundosDoHorario(texto) {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(texto));
  if (!m) return NaN;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3] || 0);
}

/** Segundos desde 00:00 de um ISO local ("2026-11-17T14:03:05-03:00"), lendo o relógio escrito no texto. */
export function segundosDoIso(iso) {
  const m = /T(\d{2}):(\d{2}):(\d{2})/.exec(String(iso));
  if (!m) return NaN;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

export function formatarHoraMinuto(segundos) {
  const s = Math.max(0, Math.floor(segundos));
  return `${dois(Math.floor(s / 3600) % 24)}:${dois(Math.floor((s % 3600) / 60))}`;
}

export function rotuloHora(h) {
  return `${dois(h)}h`;
}

/** Posição (0..100, em %) de um instante do dia na régua de 24 h. */
export function posicaoNaRegua(segundos) {
  const p = (segundos / 86400) * 100;
  return Math.min(100, Math.max(0, p));
}

/** Largura (em %) de uma duração na régua de 24 h; limitada ao fim do dia. */
export function larguraNaRegua(inicioSegundos, duracaoSegundos) {
  const fim = Math.min(86400, inicioSegundos + duracaoSegundos);
  return Math.max(0, ((fim - inicioSegundos) / 86400) * 100);
}

/** Intensidade 0..1 → 'fraca' | 'média' | 'forte'. Limiares: <0,34 e <0,67. */
export function nivelIntensidade(valor) {
  const v = Number(valor);
  if (!(v >= 0.34)) return 'fraca';
  if (v < 0.67) return 'média';
  return 'forte';
}

export function rotuloTipo(tipo) {
  return tipo === 'movimento' ? 'Movimento' : 'Som';
}

/**
 * Agrupa trechos (ordem crescente) em blocos contínuos. Dois trechos são contíguos se o
 * próximo começa até trechoSegundos + 5 s depois do início do anterior e os dois têm o
 * mesmo tipo (com vídeo / só áudio). Um bloco nunca atravessa a virada de hora.
 * Cada bloco: { hora, inicio, fim, soAudio, trechos, indices } (inicio/fim em segundos).
 */
export function agruparBlocos(trechos, trechoSegundos) {
  const blocos = [];
  let atual = null;
  let anterior = null;
  trechos.forEach((t, indice) => {
    const ini = segundosDoHorario(t.inicio);
    if (Number.isNaN(ini)) return;
    const hora = Math.floor(ini / 3600);
    const soAudio = Boolean(t.soAudio);
    const contiguo = atual !== null
      && soAudio === atual.soAudio
      && hora === atual.hora
      && ini >= anterior
      && ini - anterior <= trechoSegundos + FOLGA_CONTIGUO_SEGUNDOS;
    if (!contiguo) {
      atual = { hora, inicio: ini, fim: ini + trechoSegundos, soAudio, trechos: [], indices: [] };
      blocos.push(atual);
    }
    atual.trechos.push(t);
    atual.indices.push(indice);
    atual.fim = Math.max(atual.fim, ini + trechoSegundos);
    anterior = ini;
  });
  return blocos;
}

/**
 * Monta a lista do dia, da hora mais recente para a mais antiga. Horas sem trecho nem
 * evento, seguidas, viram uma faixa só ("00h–09h · sem gravação"). `ate` é a última hora
 * mostrada (hoje: a hora atual; outro dia: 23).
 * Itens: { tipo: 'hora', hora, blocos, eventos } | { tipo: 'vazio', de, ate, rotulo }.
 */
export function montarLista({ trechos, eventos, trechoSegundos, ate = 23 }) {
  const blocos = agruparBlocos(trechos, trechoSegundos);
  const porHora = Array.from({ length: 24 }, (_, hora) => ({ tipo: 'hora', hora, blocos: [], eventos: [] }));
  for (const b of blocos) porHora[b.hora].blocos.push(b);
  for (const e of eventos) {
    const s = segundosDoIso(e.inicio);
    if (!Number.isNaN(s)) porHora[Math.floor(s / 3600) % 24].eventos.push(e);
  }
  const ultima = Math.min(23, Math.max(0, ate));
  const itens = [];
  let vazioFim = null;
  const fecharVazio = (de) => {
    if (vazioFim === null) return;
    itens.push({ tipo: 'vazio', de, ate: vazioFim, rotulo: de === vazioFim ? `${rotuloHora(de)} · sem gravação` : `${rotuloHora(de)}–${rotuloHora(vazioFim)} · sem gravação` });
    vazioFim = null;
  };
  for (let h = ultima; h >= 0; h--) {
    const p = porHora[h];
    if (p.blocos.length || p.eventos.length) {
      fecharVazio(h + 1);
      itens.push(p);
    } else if (vazioFim === null) {
      vazioFim = h;
    }
  }
  fecharVazio(0);
  return itens;
}

/** Segmentos da mini-régua de 60 min de uma hora: { de, para, soAudio } em % (0..100). */
export function segmentosDaHora(blocos, hora) {
  return blocos.map((b) => ({
    de: Math.min(100, Math.max(0, ((b.inicio - hora * 3600) / 3600) * 100)),
    para: Math.min(100, Math.max(0, ((b.fim - hora * 3600) / 3600) * 100)),
    soAudio: b.soAudio,
  }));
}

/** Texto "N evento(s)" no singular/plural. */
export function textoEventos(n) {
  return n === 1 ? '1 evento' : `${n} eventos`;
}

/** Texto da pílula: "1 evento novo · ver" / "N eventos novos · ver". */
export function textoPilula(n) {
  return n === 1 ? '1 evento novo · ver' : `${n} eventos novos · ver`;
}

/** Rótulo do dia: "Hoje, 17/11" ou "Seg, 16/11". */
export function rotuloDia(dia, hoje) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia);
  if (!m) return dia;
  const curto = `${m[3]}/${m[2]}`;
  if (dia === hoje) return `Hoje, ${curto}`;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  const nomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  return `${nomes[d.getUTCDay()]}, ${curto}`;
}

/** Vizinhos de um dia na lista /api/dias (decrescente): anterior = mais antigo, proximo = mais novo. */
export function vizinhosDoDia(dias, dia) {
  const i = dias.indexOf(dia);
  if (i < 0) return { anterior: null, proximo: null };
  return { anterior: dias[i + 1] ?? null, proximo: dias[i - 1] ?? null };
}
