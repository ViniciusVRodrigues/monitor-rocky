// Funções puras dos avisos no celular (sem DOM): estado da tela, texto da regra e chaves do push.

/** Decide o estado do bloco "Avisos no celular". A ordem das regras importa (iOS antes do teste de PushManager). */
export function estadoAvisos({ seguro, ios, standalone, temPush, avisosLigados, permissao, inscrito }) {
  if (!seguro) return 'indisponivel';
  if (ios && !standalone) return 'instalar';
  if (!temPush) return 'sem-suporte';
  if (!avisosLigados) return 'desligado-pc';
  if (permissao === 'denied') return 'bloqueado';
  if (inscrito) return 'ativo';
  return 'pronto';
}

/** iPhone/iPod, ou iPad que se apresenta como Mac (MacIntel com toque). */
export function ehIos({ userAgent = '', platform = '', maxTouchPoints = 0 } = {}) {
  if (/iPhone|iPad|iPod/.test(userAgent)) return true;
  return platform === 'MacIntel' && maxTouchPoints > 1;
}

/** Versão do iOS (16.4 vira 16.04) a partir do user agent; null se não der para saber. */
export function versaoIos(userAgent = '') {
  const m = /OS (\d+)[_.](\d+)/.exec(userAgent);
  return m ? Number(m[1]) + Number(m[2]) / 100 : null;
}

/** iOS antigo demais para push (< 16.4). `iosVersao` vem de versaoIos (16.04 = 16.4). */
export function iosAntigo({ ios, iosVersao }) {
  if (!ios || iosVersao == null) return false;
  return Math.round(iosVersao * 100) < 1604;
}

function horaCurta(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  return m[2] === '00' ? `${h}h` : `${h}h${m[2]}`;
}

const inteiro = (n) => String(Math.round(Number(n)));

/** "Avisa quando houver som por 20 s seguidos, no máximo 1 aviso a cada 10 min." (+ silêncio, se houver). */
export function textoRegra(cfg = {}) {
  let t = `Avisa quando houver som por ${inteiro(cfg.avisoSomSegundos ?? 20)} s seguidos, no máximo 1 aviso a cada ${inteiro(cfg.avisoIntervaloMinutos ?? 10)} min.`;
  const ini = horaCurta(cfg.avisoSilencioInicio);
  const fim = horaCurta(cfg.avisoSilencioFim);
  if (ini && fim) t += ` Em silêncio das ${ini} às ${fim}.`;
  return t;
}

/** Chave pública VAPID (base64url) para os bytes que o pushManager.subscribe pede. */
export function base64urlParaBytes(texto) {
  const b64 = String(texto).replace(/-/g, '+').replace(/_/g, '/');
  const cheio = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(cheio);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Compara a chave da inscrição (ArrayBuffer ou Uint8Array; null se não houver) com a do servidor (base64url). */
export function chavesIguais(chaveInscricao, chaveServidor) {
  if (!chaveInscricao || !chaveServidor) return false;
  const a = ArrayBuffer.isView(chaveInscricao)
    ? new Uint8Array(chaveInscricao.buffer, chaveInscricao.byteOffset, chaveInscricao.byteLength)
    : new Uint8Array(chaveInscricao);
  const b = base64urlParaBytes(chaveServidor);
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

/** Só aceita caminho relativo da mesma origem ("/...", nunca "//host"). */
export function urlSegura(url) {
  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\') ? url : '/';
}
