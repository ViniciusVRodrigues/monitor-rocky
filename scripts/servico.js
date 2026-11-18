// Início automático no logon: npm run instalar-servico | remover-servico
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { carregarConfig, ConfigErro } from '../src/config.js';
import { montarTarefaXml, montarVbs, comandosSchtasks, processosDoMonitor } from '../src/tarefa.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const acao = process.argv[2];

function schtasks(args) {
  const r = spawnSync('schtasks', args, { encoding: 'utf8', windowsHide: true });
  return { codigo: r.status, saida: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim(), erro: r.error };
}

/** Processos do Windows como { pid, ppid, nome, linha } (CIM, sem precisar de admin). */
function listarProcessos() {
  const ps = 'Get-CimInstance Win32_Process | ForEach-Object { [pscustomobject]@{ pid = $_.ProcessId; ppid = $_.ParentProcessId; nome = $_.Name; linha = $_.CommandLine } } | ConvertTo-Json -Compress';
  const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  try { const j = JSON.parse(r.stdout); return Array.isArray(j) ? j : [j]; } catch { return []; }
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
    schtasks(tarefa.encerrar); // para a tarefa em execução (derruba wscript e vigia) antes de apagar
    const r = schtasks(tarefa.remover);
    if (r.codigo !== 0) { console.error(`Não consegui remover a tarefa "${nome}": ${r.saida}`); process.exit(1); }
    rmSync(vbs, { force: true });
    console.log(`Tarefa "${nome}" removida.`);
    // Para o que ainda roda: vigia, monitor e ffmpeg deste checkout (a tarefa só segura o wscript e o
    // vigia; o ffmpeg é neto). Achados pela linha de comando, sem depender do vigia.pid (pode estar velho).
    const orfaos = listarProcessos().filter((p) => p.pid !== process.pid);
    const alvos = processosDoMonitor(orfaos, raiz);
    for (const pid of alvos) spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true });
    rmSync(join(pastaLog, 'vigia.pid'), { force: true });
    console.log(alvos.length ? `Encerrados ${alvos.length} processos do monitor (vigia, node, ffmpeg).` : 'Nenhum processo do monitor em execução.');
  }
} catch (e) {
  console.error(e instanceof ConfigErro ? e.message : `Falhou: ${e.message}`);
  process.exit(1);
}
