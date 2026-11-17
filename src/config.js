import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, isAbsolute } from 'node:path';

export class ConfigErro extends Error {}

const NUMEROS_POSITIVOS = ['trechoSegundos', 'bufferHoras'];

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
    if (!(Number(cfg[chave]) > 0)) {
      throw new ConfigErro(`Configuração inválida: "${chave}" precisa ser um número maior que zero.`);
    }
  }
  if (typeof cfg.pasta !== 'string' || !cfg.pasta.trim()) {
    throw new ConfigErro('Configuração inválida: "pasta" não pode ficar vazia.');
  }
  cfg.pasta = isAbsolute(cfg.pasta) ? cfg.pasta : resolve(raiz, cfg.pasta);
  return cfg;
}

/** Exige câmera e microfone configurados, com mensagem em pt-BR. */
export function validarDispositivos(cfg) {
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
