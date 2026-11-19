import { join } from 'node:path';
import webpush from 'web-push';
import { criarArmazem } from './armazem.js';
import { AvisoErro, endpointPermitido, validarInscricao } from './endpoint.js';

const TOPIC = /^[A-Za-z0-9_-]{1,32}$/;

const hostDe = (endpoint) => { try { return new URL(endpoint).hostname; } catch { return '?'; } };

/**
 * Avisos por web push: chaves VAPID, inscrições e envio.
 * `enviar(sub, texto, opcoes)` e `gerarChaves()` são trocáveis nos testes.
 */
export function criarAvisos({ cfg, log = () => {}, enviar, gerarChaves, agora }) {
  if (cfg.avisos === false) {
    return {
      ligado: false, chavePublica: () => '', inscrever() { throw new AvisoErro(404, 'Avisos desligados.'); },
      cancelar: () => false, tem: () => false, quantas: () => 0,
      enviarTodos: async () => ({ enviados: 0, apagados: 0, falhas: 0 }),
      enviarPara: async () => { throw new AvisoErro(404, 'Avisos desligados.'); },
    };
  }
  const hosts = cfg.avisosHostsPush ?? [];
  const envia = enviar ?? ((sub, texto, opcoes) => webpush.sendNotification(sub, texto, opcoes));
  const gera = gerarChaves ?? (() => webpush.generateVAPIDKeys());
  const armazem = criarArmazem({ dir: join(cfg.pasta, cfg.avisosPasta ?? 'avisos'), maxInscricoes: cfg.avisosMaxInscricoes ?? 10, agora, log });
  const chaves = armazem.lerOuGerarChaves(gera);

  function opcoesEnvio(payload) {
    const o = {
      vapidDetails: { subject: cfg.avisosContato, publicKey: chaves.publica, privateKey: chaves.privada },
      TTL: cfg.avisoValidadeSegundos,
      urgency: 'high',
      timeout: (cfg.avisoEnvioTimeoutSegundos ?? 15) * 1000,
    };
    if (typeof payload.tag === 'string' && TOPIC.test(payload.tag)) o.topic = payload.tag;
    return o;
  }

  /** Envia a uma inscrição. Devolve 'ok', 'apagada' ou 'falha'. */
  async function um(sub, texto, opcoes) {
    if (!endpointPermitido(sub.endpoint, hosts)) {
      armazem.cancelar(sub.endpoint);
      log(`Avisos: inscrição com endereço fora da lista (${hostDe(sub.endpoint)}) apagada.`);
      return 'apagada';
    }
    try {
      await envia({ endpoint: sub.endpoint, keys: sub.keys }, texto, opcoes);
      return 'ok';
    } catch (e) {
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        armazem.cancelar(sub.endpoint);
        log(`Avisos: inscrição expirada em ${hostDe(sub.endpoint)} (${e.statusCode}); apagada.`);
        return 'apagada';
      }
      const motivo = e?.statusCode ? `HTTP ${e.statusCode}` : (e?.message ?? e);
      log(`Avisos: falha ao enviar para ${hostDe(sub.endpoint)}: ${motivo}`);
      return 'falha';
    }
  }

  return {
    ligado: true,
    chavePublica: () => chaves.publica,
    inscrever(corpo) {
      const sub = validarInscricao(corpo, hosts);
      armazem.inscrever(sub);
      return sub;
    },
    cancelar: (endpoint) => armazem.cancelar(endpoint),
    tem: (endpoint) => armazem.tem(endpoint),
    quantas: () => armazem.listar().length,
    async enviarTodos(payload) {
      const texto = JSON.stringify(payload);
      const opcoes = opcoesEnvio(payload);
      const r = await Promise.allSettled(armazem.listar().map((s) => um(s, texto, opcoes)));
      const res = { enviados: 0, apagados: 0, falhas: 0 };
      for (const x of r) {
        const v = x.status === 'fulfilled' ? x.value : 'falha';
        if (v === 'ok') res.enviados++; else if (v === 'apagada') res.apagados++; else res.falhas++;
      }
      return res;
    },
    async enviarPara(endpoint, payload) {
      const sub = armazem.listar().find((s) => s.endpoint === endpoint);
      if (!sub) throw new AvisoErro(404, 'Este aparelho não está inscrito.');
      const v = await um(sub, JSON.stringify(payload), opcoesEnvio(payload));
      if (v === 'apagada') throw new AvisoErro(404, 'Este aparelho não está inscrito.');
      if (v === 'falha') throw new AvisoErro(502, 'O serviço de push recusou o aviso.');
    },
  };
}
