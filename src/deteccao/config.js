import { ConfigErro } from '../config.js';
import { exigirNumero } from '../validar.js';

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
  clipeMargemSegundos: 10,
  clipePreset: 'veryfast',
  clipeCrf: 26,
  clipeTimeoutSegundos: 120,
  clipeSondagensSimultaneas: 3,
  clipeSondagemTimeoutSegundos: 15,
  trechoSegundos: 60,
  miniaturaLargura: 320,
  clipesDias: 30,
};

const POSITIVOS = [
  'somJanelaMs', 'movimentoLargura', 'movimentoFps', 'movimentoQuadrosSeguidos',
  'eventoJuntarSegundos', 'eventoMaxSegundos', 'miniaturaLargura', 'clipeSondagensSimultaneas', 'trechoSegundos',
];
const NAO_NEGATIVOS = [
  'somDuracaoMinimaMs', 'eventoPreSegundos', 'eventoPosSegundos', 'clipeMargemSegundos', 'clipeCrf', 'clipeTimeoutSegundos', 'clipeSondagemTimeoutSegundos', 'clipesDias',
];

/** Junta os padrões da detecção com a config carregada e valida (mensagens em pt-BR). */
export function configDeteccao(cfg) {
  const c = { ...PADROES, ...cfg };
  const erro = (m) => { throw new ConfigErro(`Configuração inválida: ${m}`); };
  for (const k of POSITIVOS) exigirNumero(k, c[k], { minExclusivo: 0 });
  for (const k of NAO_NEGATIVOS) exigirNumero(k, c[k], { min: 0 });
  exigirNumero('clipeTimeoutSegundos', c.clipeTimeoutSegundos, { min: 0, max: 86400, descricao: 'um número de segundos, até 86400 (0 = sem limite)' });
  exigirNumero('clipeSondagensSimultaneas', c.clipeSondagensSimultaneas, { inteiro: true, min: 1, max: 16, descricao: 'um número inteiro de 1 a 16' });
  exigirNumero('clipeSondagemTimeoutSegundos', c.clipeSondagemTimeoutSegundos, { min: 0, max: 3600, descricao: 'um número de segundos, até 3600 (0 = sem limite)' });
  exigirNumero('clipesDias', c.clipesDias, { inteiro: true, min: 0, max: 36500, descricao: 'um número inteiro de dias, até 36500 (0 = nunca apagar)' });
  exigirNumero('somLimiarDb', c.somLimiarDb, { maxExclusivo: 0, descricao: 'negativo (dBFS, ex.: -30)' });
  exigirNumero('movimentoLimiarPixel', c.movimentoLimiarPixel, { min: 0, max: 255, descricao: 'um número de 0 a 255' });
  exigirNumero('movimentoAreaMinima', c.movimentoAreaMinima, { minExclusivo: 0, max: 1, descricao: 'uma fração entre 0 e 1' });
  if (!String(c.movimentoCanal ?? '').trim()) erro('"movimentoCanal" não pode ficar vazio.');
  if (!/^\d+x\d+$/.test(String(c.resolucao ?? ''))) erro('"resolucao" precisa ser LARGURAxALTURA (ex.: 1280x720).');
  return c;
}
