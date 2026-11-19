import { criarRegra, textoAviso } from './regra.js';

/**
 * Liga o som longo da detecção ao envio dos avisos (ROCKY-6): sem inscrição não
 * envia nem gasta o intervalo; a regra cuida do intervalo mínimo e do silêncio.
 * Devolve a função de desligar.
 */
export function ligarAvisoSom({ det, avisos, cfg, log = () => {}, agora = () => new Date() }) {
  if (!avisos?.ligado || typeof det?.aoSomLongo !== 'function') return () => {};
  const regra = criarRegra({
    intervaloMs: (Number(cfg.avisoIntervaloMinutos) || 0) * 60 * 1000,
    silencioInicio: cfg.avisoSilencioInicio ?? '',
    silencioFim: cfg.avisoSilencioFim ?? '',
  });
  return det.aoSomLongo(async ({ inicio }) => {
    if (avisos.quantas() === 0) return;
    if (!regra.permitir(agora())) return;
    try {
      const r = await avisos.enviarTodos(textoAviso({ segundos: Number(cfg.avisoSomSegundos), inicio: new Date(inicio) }));
      log(`Aviso de som longo enviado (${r.enviados} aparelho(s)${r.apagados ? `, ${r.apagados} inscrição(ões) apagada(s)` : ''}${r.falhas ? `, ${r.falhas} falha(s)` : ''}).`);
    } catch (e) {
      log(`Aviso de som longo falhou: ${e.message}`);
    }
  });
}
