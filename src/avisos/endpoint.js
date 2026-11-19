/** Validação da inscrição de push: o endpoint vem do navegador, então é dado não confiável. */

export class AvisoErro extends Error {
  constructor(status, msg) { super(msg); this.status = status; }
}

const ENDPOINT_MAX = 2048;
const B64URL = /^[A-Za-z0-9_-]+$/;

/** true só para https, sem login, porta 443, host igual a um item da lista ou subdomínio dele. */
export function endpointPermitido(url, hosts = []) {
  if (typeof url !== 'string' || !url || url.length > ENDPOINT_MAX) return false;
  let u;
  try { u = new URL(url); } catch { return false; }
  if (u.protocol !== 'https:' || u.username || u.password) return false;
  if (u.port && u.port !== '443') return false;
  const host = u.hostname.toLowerCase();
  return hosts.some((x) => {
    const h = String(x).toLowerCase();
    return h && (host === h || host.endsWith('.' + h));
  });
}

function bytes(valor, tamanho) {
  if (typeof valor !== 'string' || !B64URL.test(valor) || valor.length > 200) return null;
  const b = Buffer.from(valor, 'base64url');
  return b.length === tamanho ? b : null;
}

/** Devolve `{endpoint, keys:{p256dh, auth}}` limpo ou lança AvisoErro 400. */
export function validarInscricao(corpo, hosts) {
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) throw new AvisoErro(400, 'Inscrição inválida.');
  const { endpoint, keys } = corpo;
  if (typeof endpoint !== 'string' || endpoint.length > ENDPOINT_MAX) throw new AvisoErro(400, 'Endereço da inscrição inválido.');
  if (!endpointPermitido(endpoint, hosts)) throw new AvisoErro(400, 'Serviço de push não permitido.');
  if (!keys || typeof keys !== 'object') throw new AvisoErro(400, 'Chaves da inscrição inválidas.');
  const p = bytes(keys.p256dh, 65);
  if (!p || p[0] !== 4) throw new AvisoErro(400, 'Chave p256dh inválida.');
  if (!bytes(keys.auth, 16)) throw new AvisoErro(400, 'Chave auth inválida.');
  return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}
