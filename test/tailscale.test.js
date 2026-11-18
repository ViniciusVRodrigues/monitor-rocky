import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { carregarConfig, ConfigErro } from '../src/config.js';
import { funnelLigado, nomeDns, lerJsonStatus, executar, TailscaleErro } from '../scripts/tailscale.js';

const SERVE = {
  TCP: { 443: { HTTPS: true } },
  Web: { 'pc.tail1.ts.net:443': { Handlers: { '/': { Proxy: 'http://127.0.0.1:8321' } } } },
};
const COM_FUNNEL = { ...SERVE, AllowFunnel: { 'pc.tail1.ts.net:443': true } };
const STATUS = { Self: { DNSName: 'PC.tail1.ts.net.' } };

test('funnelLigado: acha AllowFunnel verdadeiro, inclusive em Foreground', () => {
  assert.equal(funnelLigado({}), false);
  assert.equal(funnelLigado(SERVE), false);
  assert.equal(funnelLigado({ ...SERVE, AllowFunnel: { 'x:443': false } }), false);
  assert.equal(funnelLigado(COM_FUNNEL), true);
  assert.equal(funnelLigado({ Foreground: { abc: COM_FUNNEL } }), true);
});

test('lerJsonStatus: vazio vira {}; texto que não é JSON é erro (não deu para confirmar)', () => {
  assert.deepEqual(lerJsonStatus('  \n'), {});
  assert.deepEqual(lerJsonStatus(JSON.stringify(SERVE)), SERVE);
  assert.throws(() => lerJsonStatus('No serve config'), TailscaleErro);
  assert.throws(() => lerJsonStatus('[1]'), TailscaleErro);
});

test('nomeDns: minúsculas e sem o ponto final', () => {
  assert.equal(nomeDns(STATUS), 'pc.tail1.ts.net');
  assert.equal(nomeDns({}), '');
});

/** Tailscale falso: responde por subcomando e guarda as chamadas. */
function falso({ serve = SERVE, depois = SERVE, status = STATUS, falhar } = {}) {
  const chamadas = [];
  let ligado = false;
  const rodar = async (args) => {
    chamadas.push(args.join(' '));
    if (falhar) { const e = new Error('spawn tailscale ENOENT'); e.code = 'ENOENT'; throw e; }
    if (args[0] === 'status') return { code: 0, stdout: JSON.stringify(status), stderr: '' };
    if (args[0] === 'serve' && args[1] === 'status') return { code: 0, stdout: JSON.stringify(ligado ? depois : serve), stderr: '' };
    if (args[0] === 'serve') { ligado = !args.includes('off'); return { code: 0, stdout: '', stderr: '' }; }
    return { code: 1, stdout: '', stderr: 'desconhecido' };
  };
  return { rodar, chamadas };
}
const cfg = { servidorPorta: 8321, hostsPermitidos: ['pc.tail1.ts.net'] };

test('ligar: liga só o serve em segundo plano para 127.0.0.1:<porta>, nunca funnel', async () => {
  const t = falso({ serve: {} });
  const linhas = [];
  await executar('ligar', { cfg, rodar: t.rodar, saida: (l) => linhas.push(l) });
  assert.ok(t.chamadas.includes('serve --bg --https=443 http://127.0.0.1:8321'));
  assert.ok(!t.chamadas.some((c) => c.includes('funnel')), 'nunca chama funnel');
  assert.ok(!t.chamadas.some((c) => c.includes('reset')), 'nunca reset');
  assert.match(linhas.join('\n'), /https:\/\/pc\.tail1\.ts\.net\//);
  assert.doesNotMatch(linhas.join('\n'), /hostsPermitidos/, 'host já está na lista: sem aviso');
});

test('ligar: recusa com Funnel ligado e não liga o serve', async () => {
  const t = falso({ serve: COM_FUNNEL });
  await assert.rejects(executar('ligar', { cfg, rodar: t.rodar, saida: () => {} }), (e) => e instanceof TailscaleErro && /Funnel/.test(e.message));
  assert.ok(!t.chamadas.some((c) => c.startsWith('serve --bg')));
});

test('ligar: status ilegível recusa; Funnel aparecendo depois desliga de novo e falha', async () => {
  const chamadas = [];
  const ruim = async (args) => { chamadas.push(args.join(' ')); return { code: 0, stdout: args[1] === 'status' ? 'lixo' : '', stderr: '' }; };
  await assert.rejects(executar('ligar', { cfg, rodar: ruim, saida: () => {} }), /confirmar/);
  assert.ok(!chamadas.some((c) => c.startsWith('serve --bg')));
  const t = falso({ serve: {}, depois: COM_FUNNEL });
  await assert.rejects(executar('ligar', { cfg, rodar: t.rodar, saida: () => {} }), /Funnel/);
  assert.ok(t.chamadas.includes('serve --https=443 off'), 'desligou o que acabou de ligar');
});

test('serve status com código de saída diferente de zero recusa ligar', async () => {
  const rodar = async (args) => ({ code: args[1] === 'status' ? 1 : 0, stdout: '', stderr: 'falhou' });
  await assert.rejects(executar('ligar', { cfg, rodar, saida: () => {} }), TailscaleErro);
});

test('ligar e estado: avisam quando o host da tailnet falta em hostsPermitidos', async () => {
  for (const cmd of ['ligar', 'estado']) {
    const linhas = [];
    await executar(cmd, { cfg: { servidorPorta: 8321, hostsPermitidos: [] }, rodar: falso({ serve: {} }).rodar, saida: (l) => linhas.push(l) });
    assert.match(linhas.join('\n'), /"pc\.tail1\.ts\.net" em "hostsPermitidos"/, cmd);
  }
});

test('outra porta HTTPS entra no comando e no host esperado', async () => {
  const t = falso({ serve: {} });
  const linhas = [];
  await executar('ligar', { cfg: { ...cfg, tailscaleHttpsPorta: 8443 }, rodar: t.rodar, saida: (l) => linhas.push(l) });
  assert.ok(t.chamadas.includes('serve --bg --https=8443 http://127.0.0.1:8321'));
  assert.match(linhas.join('\n'), /pc\.tail1\.ts\.net:8443/);
});

test('desligar remove só esta entrada; estado mostra ligado/desligado e Funnel', async () => {
  const t = falso();
  await executar('desligar', { cfg, rodar: t.rodar, saida: () => {} });
  assert.deepEqual(t.chamadas, ['serve --https=443 off']);
  const linhas = [];
  await executar('estado', { cfg, rodar: falso({ serve: COM_FUNNEL }).rodar, saida: (l) => linhas.push(l) });
  assert.match(linhas.join('\n'), /Funnel.*LIGADO/i);
  const l1 = [];
  await executar('estado', { cfg, rodar: falso({ serve: SERVE }).rodar, saida: (l) => l1.push(l) });
  assert.match(l1.join('\n'), /Serve: ligado/);
  const l2 = [];
  await executar('estado', { cfg, rodar: falso({ serve: {} }).rodar, saida: (l) => l2.push(l) });
  assert.match(l2.join('\n'), /Serve: desligado/);
});

test('Tailscale ausente vira erro em pt-BR; comando desconhecido também', async () => {
  await assert.rejects(executar('estado', { cfg, rodar: falso({ falhar: true }).rodar, saida: () => {} }), /não encontrado/);
  await assert.rejects(executar('abrir', { cfg, rodar: falso().rodar, saida: () => {} }), /Uso/);
});

test('config: tailscaleLoginsPermitidos é lista de textos (minúsculas) e chaves do script validadas', () => {
  const base = { video: 'a', audio: 'b', pasta: 'g', trechoSegundos: 60, bufferHoras: 4 };
  const raiz = mkdtempSync(join(tmpdir(), 'rocky-ts-'));
  try {
    writeFileSync(join(raiz, 'config.json'), JSON.stringify({ ...base, tailscaleLoginsPermitidos: [' Eu@Exemplo.com '] }));
    assert.deepEqual(carregarConfig(raiz).tailscaleLoginsPermitidos, ['eu@exemplo.com']);
    for (const ruim of [{ tailscaleLoginsPermitidos: 'a@b.c' }, { tailscaleLoginsPermitidos: [''] }, { tailscaleLoginsPermitidos: [1] },
      { tailscaleExe: '' }, { tailscaleHttpsPorta: 0 }, { tailscaleHttpsPorta: 70000 }, { tailscaleHttpsPorta: '443' }]) {
      writeFileSync(join(raiz, 'config.json'), JSON.stringify({ ...base, ...ruim }));
      assert.throws(() => carregarConfig(raiz), ConfigErro, JSON.stringify(ruim));
    }
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});
