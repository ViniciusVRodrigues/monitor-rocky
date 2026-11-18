import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, isAbsolute } from 'node:path';
import { nomeGuardados } from './servidor/gravacoes.js';

export class ConfigErro extends Error {}

const NUMEROS_POSITIVOS = [
  'trechoSegundos', 'bufferHoras', 'fps', 'fpsCamera', 'crf', 'audioHz', 'audioCanais',
  'limpezaMinutos', 'aovivoSegundos', 'aovivoSegmentos', 'esperaReinicioSegundos',
  'esperaReinicioMaxSegundos', 'ouvirHz',
  'logMaxMB', 'vigiaEsperaSegundos', 'vigiaEsperaMaxSegundos', 'vigiaEstavelSegundos',
  'saudeIntervaloSegundos', 'alertaFalhasSeguidas', 'alertaEstavelSegundos',
  'servidorPorta', 'ouvirSiteMax', 'ouvirFolgaMs', 'ouvirAtrasoMaxMs',
  'ouvirMp3AtrasoMaxSegundos', 'sseBatidaSegundos', 'linhaTempoAtualizarSegundos',
  'controleTempoLimiteSegundos', 'nivelHz', 'saudeTimeoutMs', 'aovivoConectarSegundos', 'ouvirCompRazao',
  'logJanelaSegundos', 'logLinhasPorJanela', 'logFilaMaxKB',
];
const PRIORIDADES = ['abaixo', 'normal', 'acima', 'alta'];
const ESTADOS_INICIAIS = ['gravando', 'so-som', 'parado'];

function lerJson(arquivo) {
  try {
    return JSON.parse(readFileSync(arquivo, 'utf8'));
  } catch (e) {
    throw new ConfigErro(`Não consegui ler ${arquivo}: ${e.message}`);
  }
}

/** Lê config.json e sobrepõe com config.local.json (se existir). */
export function carregarConfig(raiz) {
  const padrao = lerJson(join(raiz, 'config.json'));
  const arquivoLocal = join(raiz, 'config.local.json');
  const local = existsSync(arquivoLocal) ? lerJson(arquivoLocal) : {};
  const cfg = { ...padrao, ...local };

  for (const chave of NUMEROS_POSITIVOS) {
    if (chave === 'fpsCamera' && cfg[chave] === null) continue; // null = usa fps
    if (cfg[chave] === undefined && !['trechoSegundos', 'bufferHoras'].includes(chave)) continue;
    if (!(Number(cfg[chave]) > 0)) {
      throw new ConfigErro(`Configuração inválida: "${chave}" precisa ser um número maior que zero.`);
    }
  }
  if (cfg.tarefaPrioridade !== undefined && !(Number.isInteger(cfg.tarefaPrioridade) && cfg.tarefaPrioridade >= 0 && cfg.tarefaPrioridade <= 10)) {
    throw new ConfigErro('Configuração inválida: "tarefaPrioridade" precisa ser um inteiro de 0 a 10.');
  }
  for (const k of ['ffmpegPrioridade', 'clipePrioridade']) {
    if (cfg[k] !== undefined && !PRIORIDADES.includes(cfg[k])) {
      throw new ConfigErro(`Configuração inválida: "${k}" precisa ser ${PRIORIDADES.join(', ')}.`);
    }
  }
  if (cfg.clipeCopiar !== undefined && typeof cfg.clipeCopiar !== 'boolean') {
    throw new ConfigErro('Configuração inválida: "clipeCopiar" precisa ser true ou false.');
  }
  if (typeof cfg.pasta !== 'string' || !cfg.pasta.trim()) {
    throw new ConfigErro('Configuração inválida: "pasta" não pode ficar vazia.');
  }
  if (cfg.estadoInicial !== undefined && !ESTADOS_INICIAIS.includes(cfg.estadoInicial)) {
    throw new ConfigErro(`Configuração inválida: "estadoInicial" precisa ser ${ESTADOS_INICIAIS.join(', ')}.`);
  }
  if (cfg.canalControle !== undefined && !String(cfg.canalControle).trim()) {
    throw new ConfigErro('Configuração inválida: "canalControle" não pode ficar vazio.');
  }
  if (cfg.logArquivos !== undefined && !(Number.isInteger(Number(cfg.logArquivos)) && Number(cfg.logArquivos) >= 0)) {
    throw new ConfigErro('Configuração inválida: "logArquivos" precisa ser um inteiro maior ou igual a zero.');
  }
  for (const k of ['logPasta', 'servicoNome']) {
    if (cfg[k] !== undefined && !String(cfg[k]).trim()) throw new ConfigErro(`Configuração inválida: "${k}" não pode ficar vazio.`);
  }
  if (cfg.logPasta !== undefined) cfg.logPasta = isAbsolute(cfg.logPasta) ? cfg.logPasta : resolve(raiz, cfg.logPasta);
  if (cfg.ouvirModo !== undefined && !['auto', 'pcm', 'mp3'].includes(cfg.ouvirModo)) {
    throw new ConfigErro('Configuração inválida: "ouvirModo" precisa ser auto, pcm ou mp3.');
  }
  if (cfg.hostsPermitidos !== undefined &&
      !(Array.isArray(cfg.hostsPermitidos) && cfg.hostsPermitidos.every((h) => typeof h === 'string' && h.trim()))) {
    throw new ConfigErro('Configuração inválida: "hostsPermitidos" precisa ser uma lista de textos.');
  }
  if (cfg.tailscaleLoginsPermitidos !== undefined) {
    const l = cfg.tailscaleLoginsPermitidos;
    if (!(Array.isArray(l) && l.every((x) => typeof x === 'string' && x.trim()))) {
      throw new ConfigErro('Configuração inválida: "tailscaleLoginsPermitidos" precisa ser uma lista de logins (e-mails).');
    }
    cfg.tailscaleLoginsPermitidos = l.map((x) => x.trim().toLowerCase());
  }
  if (cfg.tailscaleExe !== undefined && !(typeof cfg.tailscaleExe === 'string' && cfg.tailscaleExe.trim())) {
    throw new ConfigErro('Configuração inválida: "tailscaleExe" não pode ficar vazio.');
  }
  if (cfg.tailscaleHttpsPorta !== undefined &&
      !(Number.isInteger(cfg.tailscaleHttpsPorta) && cfg.tailscaleHttpsPorta >= 1 && cfg.tailscaleHttpsPorta <= 65535)) {
    throw new ConfigErro('Configuração inválida: "tailscaleHttpsPorta" precisa ser uma porta de 1 a 65535.');
  }
  if (cfg.ouvirMp3Bitrate !== undefined && !String(cfg.ouvirMp3Bitrate).trim()) {
    throw new ConfigErro('Configuração inválida: "ouvirMp3Bitrate" não pode ficar vazio.');
  }
  if (cfg.nivelSuavizacao !== undefined &&
      !(typeof cfg.nivelSuavizacao === 'number' && cfg.nivelSuavizacao >= 0 && cfg.nivelSuavizacao < 1)) {
    throw new ConfigErro('Configuração inválida: "nivelSuavizacao" precisa ser um número de 0 até menos de 1.');
  }
  if (cfg.nivelPisoDb !== undefined && !(typeof cfg.nivelPisoDb === 'number' && cfg.nivelPisoDb < 0)) {
    throw new ConfigErro('Configuração inválida: "nivelPisoDb" precisa ser um número negativo.');
  }
  if (cfg.somAoAbrir !== undefined && typeof cfg.somAoAbrir !== 'boolean') {
    throw new ConfigErro('Configuração inválida: "somAoAbrir" precisa ser true ou false.');
  }
  for (const k of ['ouvirGanhoDb', 'ouvirPcGanhoDb', 'ouvirCompLimiarDb', 'ouvirCompJoelhoDb']) {
    if (cfg[k] !== undefined && !(typeof cfg[k] === 'number' && Number.isFinite(cfg[k]))) {
      throw new ConfigErro(`Configuração inválida: "${k}" precisa ser um número (dB).`);
    }
  }
  if (cfg.guardadosPasta !== undefined) {
    try { nomeGuardados(cfg); } catch (e) { throw new ConfigErro(`Configuração inválida: ${e.message}`); }
  }
  if (cfg.guardarMaxArquivos !== undefined && !(Number.isInteger(cfg.guardarMaxArquivos) && cfg.guardarMaxArquivos > 0)) {
    throw new ConfigErro('Configuração inválida: "guardarMaxArquivos" precisa ser um inteiro maior que zero.');
  }
  if (cfg.apagarHoraTrechos !== undefined && typeof cfg.apagarHoraTrechos !== 'boolean') {
    throw new ConfigErro('Configuração inválida: "apagarHoraTrechos" precisa ser true ou false.');
  }
  cfg.pasta = isAbsolute(cfg.pasta) ? cfg.pasta : resolve(raiz, cfg.pasta);
  return cfg;
}

/** Exige câmera e microfone configurados, com mensagem em pt-BR. */
export function validarDispositivos(cfg) {
  if (cfg.fonte === 'teste') return;
  const faltando = [];
  if (!String(cfg.video ?? '').trim()) faltando.push('"video" (câmera)');
  if (!String(cfg.audio ?? '').trim()) faltando.push('"audio" (microfone)');
  if (faltando.length) {
    throw new ConfigErro(
      `Falta configurar ${faltando.join(' e ')} em config.local.json. ` +
      'Rode "npm run dispositivos" para ver os nomes exatos e copie-os para o arquivo.'
    );
  }
}
