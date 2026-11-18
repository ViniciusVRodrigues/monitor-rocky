/** Segurança do servidor local: Host, cabeçalhos, CSRF e Sec-Fetch-Site. */

export const CSP = "default-src 'self'; img-src 'self' data:; media-src 'self' blob:; worker-src 'self' blob:; " +
  "connect-src 'self'; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'";

/** Cabeçalhos de toda resposta. */
export function cabecalhosBase(res) {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
}

/** Hosts aceitos (sem diferenciar caixa): 127.0.0.1:<porta>, localhost:<porta> e hostsPermitidos. */
export function hostPermitido(host, porta, extras = []) {
  if (typeof host !== 'string' || !host) return false;
  const h = host.toLowerCase();
  if (h === `127.0.0.1:${porta}` || h === `localhost:${porta}`) return true;
  return extras.some((x) => String(x).toLowerCase() === h);
}

/**
 * Acesso de fora pelo Tailscale Serve (ROCKY-4). O Serve encaminha para 127.0.0.1,
 * mantém o Host da tailnet, acrescenta X-Forwarded-For e põe `Tailscale-User-Login`
 * (apagando o que o cliente mandar). Pedido "de fora" = Host fora de
 * 127.0.0.1/localhost:<porta>, ou com X-Forwarded-For, ou com identidade.
 * De fora sem identidade é sempre recusado (Funnel e máquinas com tag não mandam
 * identidade); com a lista de logins com itens, o login precisa estar nela.
 * Devolve o motivo da recusa (texto pt-BR) ou null se o pedido pode seguir.
 */
export function recusaTailscale(headers, logins = [], porta) {
  const h = String(headers.host ?? '').toLowerCase();
  const local = h === `127.0.0.1:${porta}` || h === `localhost:${porta}`;
  const temLogin = headers['tailscale-user-login'] !== undefined;
  if (local && !temLogin && headers['x-forwarded-for'] === undefined) return null;
  const login = String(headers['tailscale-user-login'] ?? '').trim().toLowerCase();
  if (!login || login.includes(',')) return 'Acesso de fora só com a sua conta do Tailscale.';
  const lista = (logins ?? []).map((x) => String(x).trim().toLowerCase());
  if (lista.length && !lista.includes(login)) return 'Esta conta do Tailscale não tem acesso.';
  return null;
}

/** Leituras: recusa pedidos marcados como de outro site. */
export function leituraPermitida(req) {
  return req.headers['sec-fetch-site'] !== 'cross-site';
}

/** CSRF do POST de controle. Devolve true se o pedido pode seguir. */
export function controlePermitido(req) {
  const h = req.headers;
  const tipo = String(h['content-type'] ?? '').split(';')[0].trim().toLowerCase();
  if (tipo !== 'application/json') return false;
  if (h['x-rocky'] !== '1') return false;
  const site = h['sec-fetch-site'];
  if (site !== undefined && site !== 'same-origin' && site !== 'none') return false;
  if (h.origin !== undefined) {
    const host = String(h.host ?? '');
    if (!host || (h.origin !== `http://${host}` && h.origin !== `https://${host}`)) return false;
  }
  return true;
}

/** Responde JSON (sem cache). */
export function json(res, status, corpo, extra = {}) {
  const txt = JSON.stringify(corpo);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(txt),
    'Cache-Control': 'no-store',
    ...extra,
  });
  res.end(txt);
}

export function naoEncontrado(res) {
  json(res, 404, { ok: false, erro: 'Não encontrado.' });
}
