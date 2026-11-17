import { ConfigErro } from '../config.js';

/** Padrões das chaves da detecção (documentadas no README). */
export const PADROES = {
  deteccao: true,
  ffprobe: 'ffprobe',
  somLimiarDb: -30,
  somJanelaMs: 100,
  somDuracaoMinimaMs: 200,
  movimentoLargura: 160,
  movimentoFps: 5,
  movimentoLimiarPixel: 25,
  movimentoAreaMinima: 0.01,
  movimentoQuadrosSeguidos: 2,
  movimentoCanal: 'monitor-rocky-movimento',
  eventoPreSegundos: 5,
  eventoPosSegundos: 5,
  eventoJuntarSegundos: 10,
  eventoMaxSegundos: 120,
  clipeMargemSegundos: 3,
  clipePreset: 'veryfast',
  clipeCrf: 26,
  miniaturaLargura: 320,
  clipesDias: 30,
};

const POSITIVOS = [
  'somJanelaMs', 'movimentoLargura', 'movimentoFps', 'movimentoQuadrosSeguidos',
  'eventoJuntarSegundos', 'eventoMaxSegundos', 'miniaturaLargura',
];
const NAO_NEGATIVOS = [
  'somDuracaoMinimaMs', 'eventoPreSegundos', 'eventoPosSegundos', 'clipeMargemSegundos', 'clipeCrf', 'clipesDias',
];

/** Junta os padrões da detecção com a config carregada e valida (mensagens em pt-BR). */
export function configDeteccao(cfg) {
  const c = { ...PADROES, ...cfg };
  const erro = (m) => { throw new ConfigErro(`Configuração inválida: ${m}`); };
  for (const k of POSITIVOS) if (!(Number(c[k]) > 0)) erro(`"${k}" precisa ser um número maior que zero.`);
  for (const k of NAO_NEGATIVOS) if (!(Number(c[k]) >= 0)) erro(`"${k}" precisa ser um número maior ou igual a zero.`);
  if (!(Number(c.somLimiarDb) < 0)) erro('"somLimiarDb" precisa ser negativo (dBFS, ex.: -30).');
  if (!(c.movimentoLimiarPixel >= 0 && c.movimentoLimiarPixel <= 255)) erro('"movimentoLimiarPixel" vai de 0 a 255.');
  if (!(c.movimentoAreaMinima > 0 && c.movimentoAreaMinima <= 1)) erro('"movimentoAreaMinima" é uma fração entre 0 e 1.');
  if (!String(c.movimentoCanal ?? '').trim()) erro('"movimentoCanal" não pode ficar vazio.');
  if (!/^\d+x\d+$/.test(String(c.resolucao ?? ''))) erro('"resolucao" precisa ser LARGURAxALTURA (ex.: 1280x720).');
  return c;
}
