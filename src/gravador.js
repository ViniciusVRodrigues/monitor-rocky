import { readFileSync, writeFileSync, renameSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

export const ESTADOS = ['gravando', 'so-som', 'parado'];

/**
 * Estado da captura: gravando (câmera + som), so-som (câmera liberada, o som
 * segue gravando) ou parado. A troca não reinicia o programa, só o ffmpeg; o
 * estado fica em `<pasta>/estado.json` e volta no próximo início.
 */
export function criarGravador({ cfg, supervisor, log = console.log }) {
  const arquivo = join(cfg.pasta, 'estado.json');
  const ouvintes = new Set();
  let atual = lerInicial();

  function lerInicial() {
    try {
      const e = JSON.parse(readFileSync(arquivo, 'utf8')).estado;
      if (ESTADOS.includes(e)) return e;
    } catch { /* sem arquivo ou ilegível: usa o padrão */ }
    return ESTADOS.includes(cfg.estadoInicial) ? cfg.estadoInicial : 'gravando';
  }

  function gravar(estado) {
    mkdirSync(cfg.pasta, { recursive: true });
    const tmp = `${arquivo}.tmp`;
    writeFileSync(tmp, JSON.stringify({ estado, atualizadoEm: new Date().toISOString() }));
    renameSync(tmp, arquivo);
  }

  function esvaziarAoVivo() {
    const dir = join(cfg.pasta, 'aovivo');
    try { for (const f of readdirSync(dir)) rmSync(join(dir, f), { force: true }); } catch { /* ainda não existe */ }
  }

  async function definirEstado(novo) {
    if (!ESTADOS.includes(novo)) throw new Error(`Estado inválido "${novo}". Use ${ESTADOS.join(', ')}.`);
    if (novo === atual) return atual;
    const antes = atual;
    atual = novo;
    gravar(novo);
    log(`Estado: ${antes} -> ${novo}`);
    if (novo === 'parado') {
      await supervisor.definirAtivo(false);
      esvaziarAoVivo();
    } else if (antes === 'parado') {
      await supervisor.definirAtivo(true);
    } else {
      await supervisor.reiniciar();
    }
    for (const fn of ouvintes) { try { fn(novo); } catch { /* ignora */ } }
    return atual;
  }

  return {
    estado: () => atual,
    definirEstado,
    iniciar: () => definirEstado('gravando'),
    parar: () => definirEstado('parado'),
    async camera(valor) {
      if (valor !== 'ligar' && valor !== 'desligar') throw new Error('Use "ligar" ou "desligar".');
      if (atual === 'parado') throw new Error('A captura está no estado parado; use "iniciar" primeiro.');
      return definirEstado(valor === 'desligar' ? 'so-som' : 'gravando');
    },
    aoMudar(fn) { ouvintes.add(fn); return () => ouvintes.delete(fn); },
  };
}
