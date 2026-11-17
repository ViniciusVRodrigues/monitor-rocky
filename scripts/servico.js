// Início automático no logon: npm run instalar-servico | remover-servico
import { writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { carregarConfig, ConfigErro } from '../src/config.js';
import { montarTarefaXml, montarVbs, comandosSchtasks } from '../src/tarefa.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const acao = process.argv[2];

function schtasks(args) {
  const r = spawnSync('schtasks', args, { encoding: 'utf8', windowsHide: true });
  return { codigo: r.status, saida: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim(), erro: r.error };
}

try {
  if (!['instalar', 'remover'].includes(acao)) { console.error('Uso: npm run instalar-servico | remover-servico'); process.exit(2); }
  if (process.platform !== 'win32') { console.error('O início automático só funciona no Windows.'); process.exit(1); }
  const cfg = carregarConfig(raiz);
  const nome = cfg.servicoNome ?? 'monitor-rocky';
  const pastaLog = cfg.logPasta ?? join(raiz, 'logs');
  const vbs = join(pastaLog, 'iniciar-oculto.vbs');
  const tarefa = comandosSchtasks(nome, join(tmpdir(), `${nome}-tarefa.xml`));

  if (acao === 'instalar') {
    mkdirSync(pastaLog, { recursive: true });
    // UTF-16 com BOM: o wscript lê ANSI por padrão e quebraria caminhos com acento
    writeFileSync(vbs, `﻿${montarVbs({ node: process.execPath, vigia: join(raiz, 'src', 'vigia.js'), raiz })}`, 'utf16le');
    const usuario = `${process.env.USERDOMAIN ?? ''}\\${process.env.USERNAME ?? ''}`.replace(/^\\/, '');
    const xml = montarTarefaXml({ usuario, vbs, descricao: 'Monitor Rocky: sobe o vigia da babá eletrônica no logon.', prioridade: cfg.tarefaPrioridade ?? undefined });
    writeFileSync(tarefa.criar[4], `﻿${xml}`, 'utf16le');
    const r = schtasks(tarefa.criar);
    rmSync(tarefa.criar[4], { force: true });
    if (r.codigo !== 0) { console.error(`Não consegui criar a tarefa "${nome}": ${r.saida || r.erro?.message}`); process.exit(1); }
    console.log(`Tarefa "${nome}" instalada: o monitor sobe sozinho quando você entrar no Windows.`);
    console.log(`Log em ${pastaLog}. Para iniciar agora sem sair da conta: schtasks /Run /TN ${nome}`);
  } else {
    if (schtasks(tarefa.consultar).codigo !== 0) { console.log(`A tarefa "${nome}" não existe; nada a remover.`); process.exit(0); }
    const r = schtasks(tarefa.remover);
    if (r.codigo !== 0) { console.error(`Não consegui remover a tarefa "${nome}": ${r.saida}`); process.exit(1); }
    rmSync(vbs, { force: true });
    console.log(`Tarefa "${nome}" removida.`);
    // encerra o vigia que ainda esteja rodando (e o monitor dele), pelo PID gravado
    const arqPid = join(pastaLog, 'vigia.pid');
    try {
      const pid = Number(readFileSync(arqPid, 'utf8'));
      const vivo = pid > 0 && /node.exe/i.test(spawnSync('tasklist', ['/FI', `PID eq ${pid}`, '/NH'], { encoding: 'utf8', windowsHide: true }).stdout ?? '');
      if (vivo) {
        spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true });
        console.log('Vigia e monitor em execução foram encerrados.');
      }
      rmSync(arqPid, { force: true });
    } catch { /* não havia vigia rodando */ }
  }
} catch (e) {
  console.error(e instanceof ConfigErro ? e.message : `Falhou: ${e.message}`);
  process.exit(1);
}
