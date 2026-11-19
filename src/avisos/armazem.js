import { mkdirSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { isoLocal } from '../deteccao/tempo.js';

/** Grava JSON de forma atômica (arquivo .tmp + rename). */
function gravar(arquivo, dados) {
  const tmp = `${arquivo}.tmp`;
  try {
    writeFileSync(tmp, JSON.stringify(dados, null, 2));
    renameSync(tmp, arquivo);
  } catch (e) {
    try { rmSync(tmp, { force: true }); } catch { /* ignora */ }
    throw e;
  }
}

const textoOk = (v) => typeof v === 'string' && v.length > 0;

/**
 * Chaves VAPID e inscrições em `dir` (`vapid.json` e `inscricoes.json`).
 * A pasta só é criada quando algo é gravado.
 */
export function criarArmazem({ dir, maxInscricoes = 10, agora = () => new Date(), log = () => {} }) {
  const arqChaves = join(dir, 'vapid.json');
  const arqSubs = join(dir, 'inscricoes.json');
  let subs = null;

  function carregar() {
    if (subs) return subs;
    subs = [];
    let bruto;
    try { bruto = readFileSync(arqSubs, 'utf8'); } catch (e) {
      if (e.code !== 'ENOENT') log(`Avisos: não consegui ler inscricoes.json (${e.message}); começando vazio.`);
      return subs;
    }
    try {
      const lista = JSON.parse(bruto);
      if (!Array.isArray(lista)) throw new Error('não é uma lista');
      subs = lista.filter((s) => s && textoOk(s.endpoint) && s.keys && textoOk(s.keys.p256dh) && textoOk(s.keys.auth))
        .map((s) => ({ endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth }, criada: String(s.criada ?? '') }));
    } catch (e) {
      log(`Avisos: inscricoes.json inválido (${e.message}); começando vazio.`);
      subs = [];
    }
    return subs;
  }

  function salvar() {
    mkdirSync(dir, { recursive: true });
    gravar(arqSubs, subs);
  }

  return {
    /** Lê as chaves de vapid.json ou gera com `gerar()` ({publicKey, privateKey}) e grava. */
    lerOuGerarChaves(gerar) {
      try {
        const k = JSON.parse(readFileSync(arqChaves, 'utf8'));
        if (textoOk(k?.publica) && textoOk(k?.privada)) return { publica: k.publica, privada: k.privada };
      } catch { /* gera abaixo */ }
      const g = gerar();
      const chaves = { publica: g.publicKey, privada: g.privateKey };
      mkdirSync(dir, { recursive: true });
      gravar(arqChaves, chaves);
      return chaves;
    },
    listar() { return carregar().map((s) => ({ endpoint: s.endpoint, keys: { ...s.keys }, criada: s.criada })); },
    tem(endpoint) { return carregar().some((s) => s.endpoint === endpoint); },
    inscrever(sub) {
      const lista = carregar();
      const nova = { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }, criada: isoLocal(agora()) };
      const i = lista.findIndex((s) => s.endpoint === sub.endpoint);
      if (i >= 0) lista[i] = { ...nova, criada: lista[i].criada || nova.criada };
      else lista.push(nova);
      while (lista.length > maxInscricoes) {
        let velha = 0;
        for (let j = 1; j < lista.length; j++) if (lista[j].criada < lista[velha].criada) velha = j;
        lista.splice(velha, 1);
      }
      salvar();
    },
    /** Idempotente: true se havia a inscrição. */
    cancelar(endpoint) {
      const lista = carregar();
      const i = lista.findIndex((s) => s.endpoint === endpoint);
      if (i < 0) return false;
      lista.splice(i, 1);
      salvar();
      return true;
    },
  };
}
