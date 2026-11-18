// Acesso de fora pelo Tailscale Serve: npm run tailscale -- ligar | desligar | estado
// Só usa `tailscale serve` (HTTPS dentro da tailnet). Nunca Funnel: recusa ligar se houver Funnel ativo.
// Docs: https://tailscale.com/docs/reference/tailscale-cli/serve.md
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { carregarConfig, ConfigErro } from '../src/config.js';

export class TailscaleErro extends Error {}

const USO = 'Uso: npm run tailscale -- ligar | desligar | estado';

/** Texto do `--json` para objeto. Vazio = nada configurado; outra coisa = não deu para confirmar. */
export function lerJsonStatus(texto) {
  const t = String(texto ?? '').trim();
  if (!t) return {};
  let v;
  try { v = JSON.parse(t); } catch { v = undefined; }
  if (!v || typeof v !== 'object' || Array.isArray(v)) {
    throw new TailscaleErro('Não deu para confirmar o estado do Tailscale Serve (resposta inesperada).');
  }
  return v;
}

/** True se algum `AllowFunnel` (em qualquer nível, como em Foreground) estiver ligado. */
export function funnelLigado(no) {
  if (!no || typeof no !== 'object') return false;
  for (const [k, v] of Object.entries(no)) {
    if (k === 'AllowFunnel' && v && typeof v === 'object' && Object.values(v).some(Boolean)) return true;
    if (v && typeof v === 'object' && funnelLigado(v)) return true;
  }
  return false;
}

/** True se algum handler do Serve aponta para o endereço do monitor. */
function servindo(no, alvo) {
  if (!no || typeof no !== 'object') return false;
  return Object.entries(no).some(([k, v]) =>
    (k === 'Proxy' && typeof v === 'string' && v.replace(/\/$/, '') === alvo) || servindo(v, alvo));
}

/** Nome da máquina na tailnet (`Self.DNSName`), em minúsculas e sem o ponto final. */
export function nomeDns(status) {
  return String(status?.Self?.DNSName ?? '').toLowerCase().replace(/\.$/, '');
}

async function chamar(rodar, args) {
  try {
    return await rodar(args);
  } catch (e) {
    if (e.code === 'ENOENT') {
      throw new TailscaleErro('Tailscale não encontrado. Instale o Tailscale (veja "Acesso de fora" no README) ' +
        'ou ponha o caminho do tailscale.exe em "tailscaleExe" no config.local.json.');
    }
    throw new TailscaleErro(`Falhou ao chamar o Tailscale: ${e.message}`);
  }
}

async function lerServe(rodar) {
  const r = await chamar(rodar, ['serve', 'status', '--json']);
  if (r.code !== 0) throw new TailscaleErro(`Não deu para confirmar o estado do Tailscale Serve: ${(r.stderr || r.stdout || '').trim()}`);
  return lerJsonStatus(r.stdout);
}

async function avisarHost(rodar, cfg, httpsPorta, saida) {
  const r = await chamar(rodar, ['status', '--json']);
  let dns = '';
  try { dns = r.code === 0 ? nomeDns(lerJsonStatus(r.stdout)) : ''; } catch { dns = ''; }
  if (!dns) { saida('Não deu para ler o nome da máquina na tailnet (o Tailscale está conectado?).'); return; }
  const host = httpsPorta === 443 ? dns : `${dns}:${httpsPorta}`;
  saida(`Endereço: https://${host}/`);
  const hosts = (cfg.hostsPermitidos ?? []).map((h) => String(h).toLowerCase());
  if (!hosts.includes(host)) {
    saida(`Atenção: ponha "${host}" em "hostsPermitidos" no config.local.json e reinicie o monitor; sem isso a página responde 421.`);
  }
}

/** Executa um comando. `rodar(args)` devolve { code, stdout, stderr }; `saida(linha)` mostra uma linha. */
export async function executar(cmd, { cfg, rodar, saida = console.log }) {
  if (!['ligar', 'desligar', 'estado'].includes(cmd)) throw new TailscaleErro(USO);
  const httpsPorta = cfg.tailscaleHttpsPorta ?? 443;
  const alvo = `http://127.0.0.1:${cfg.servidorPorta}`;
  const desligar = ['serve', `--https=${httpsPorta}`, 'off'];
  const MSG_FUNNEL = 'O Tailscale Funnel está ligado nesta máquina e deixaria a página pública na internet. ' +
    'Desligue-o (tailscale funnel reset) e rode de novo. Este projeto nunca usa Funnel.';

  if (cmd === 'desligar') {
    const r = await chamar(rodar, desligar);
    if (r.code !== 0) throw new TailscaleErro(`Não deu para desligar o Serve: ${(r.stderr || r.stdout || '').trim()}`);
    saida('Serve desligado: a página não é mais vista de fora.');
    return;
  }

  const antes = await lerServe(rodar);
  if (cmd === 'estado') {
    saida(`Serve: ${servindo(antes, alvo) ? `ligado (encaminha para ${alvo})` : 'desligado'}.`);
    saida(funnelLigado(antes) ? 'Funnel: LIGADO (página pública!). Desligue com: tailscale funnel reset' : 'Funnel: desligado.');
    await avisarHost(rodar, cfg, httpsPorta, saida);
    return;
  }

  // ligar
  if (funnelLigado(antes)) throw new TailscaleErro(MSG_FUNNEL);
  const r = await chamar(rodar, ['serve', '--bg', `--https=${httpsPorta}`, alvo]);
  if (r.code !== 0) throw new TailscaleErro(`Não deu para ligar o Serve: ${(r.stderr || r.stdout || '').trim()}`);
  let depois;
  try { depois = await lerServe(rodar); } catch (e) { await chamar(rodar, desligar); throw e; }
  if (funnelLigado(depois)) {
    await chamar(rodar, desligar);
    throw new TailscaleErro(MSG_FUNNEL);
  }
  saida(`Serve ligado: HTTPS só dentro da sua tailnet, encaminhando para ${alvo}.`);
  await avisarHost(rodar, cfg, httpsPorta, saida);
}

/** Roda o tailscale sem shell, com lista de argumentos. */
function rodarDe(exe) {
  return (args) => new Promise((res, rej) => {
    const p = spawn(exe, args, { windowsHide: true });
    let stdout = ''; let stderr = '';
    p.stdout.on('data', (b) => { stdout += b; });
    p.stderr.on('data', (b) => { stderr += b; });
    p.on('error', rej);
    p.on('close', (code) => res({ code, stdout, stderr }));
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
  try {
    const cfg = carregarConfig(raiz);
    await executar(process.argv[2], { cfg, rodar: rodarDe(cfg.tailscaleExe ?? 'tailscale') });
  } catch (e) {
    console.error(e instanceof TailscaleErro || e instanceof ConfigErro ? e.message : `Falhou: ${e.message}`);
    process.exit(e instanceof TailscaleErro && e.message === USO ? 2 : 1);
  }
}
