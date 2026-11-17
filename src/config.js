import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, isAbsolute } from 'node:path';

export class ConfigErro extends Error {}

const NUMEROS_POSITIVOS = [
  'trechoSegundos', 'bufferHoras', 'fps', 'fpsCamera', 'crf', 'audioHz', 'audioCanais',
  'limpezaMinutos', 'aovivoSegundos', 'aovivoSegmentos', 'esperaReinicioSegundos',
  'esperaReinicioMaxSegundos', 'ouvirHz',
  'logMaxMB', 'vigiaEsperaSegundos', 'vigiaEsperaMaxSegundos', 'vigiaEstavelSegundos',
  'saudeIntervaloSegundos', 'alertaFalhasSeguidas', 'alertaEstavelSegundos',
];
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
    if (cfg[chave] === undefined && !['trechoSegundos', 'bufferHoras'].includes(chave)) continue;
    if (!(Number(cfg[chave]) > 0)) {
      throw new ConfigErro(`Configuração inválida: "${chave}" precisa ser um número maior que zero.`);
    }
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
