import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarTarefaXml, montarVbs, comandosSchtasks, escaparXml, processosDoMonitor } from '../src/tarefa.js';

const opc = { usuario: 'PC\\vinic', vbs: 'C:\\m r\\logs\\iniciar-oculto.vbs', descricao: 'Monitor & "Rocky"' };

test('XML: gatilho de logon do usuário, sessão interativa, sem limite de tempo, instância única', () => {
  const x = montarTarefaXml(opc);
  assert.match(x, /<LogonTrigger>[\s\S]*<UserId>PC\\vinic<\/UserId>[\s\S]*<\/LogonTrigger>/);
  assert.match(x, /<LogonType>InteractiveToken<\/LogonType>/);
  assert.match(x, /<RunLevel>LeastPrivilege<\/RunLevel>/);
  assert.match(x, /<ExecutionTimeLimit>PT0S<\/ExecutionTimeLimit>/);
  assert.match(x, /<MultipleInstancesPolicy>IgnoreNew<\/MultipleInstancesPolicy>/);
  assert.match(x, /<DisallowStartIfOnBatteries>false<\/DisallowStartIfOnBatteries>/);
  assert.match(x, /<Command>wscript\.exe<\/Command>/);
  assert.match(x, /<Arguments>\/\/B \/\/Nologo &quot;C:\\m r\\logs\\iniciar-oculto\.vbs&quot;<\/Arguments>/);
  assert.match(x, /Monitor &amp; &quot;Rocky&quot;/);
});

test('escaparXml', () => assert.equal(escaparXml('<a&"b">'), '&lt;a&amp;&quot;b&quot;&gt;'));

test('VBS roda o vigia oculto (janela 0) na pasta do projeto, escapando aspas', () => {
  const v = montarVbs({ node: 'C:\\Program Files\\nodejs\\node.exe', vigia: 'C:\\r\\src\\vigia.js', raiz: 'C:\\r' });
  assert.match(v, /CurrentDirectory = "C:\\r"/);
  assert.match(v, /\.Run """C:\\Program Files\\nodejs\\node\.exe"" ""C:\\r\\src\\vigia\.js"" ""--sob-tarefa""", 0, True/);
});

test('comandos schtasks: criar com XML (substitui), remover e consultar', () => {
  const c = comandosSchtasks('monitor-rocky', 'C:\\x.xml');
  assert.deepEqual(c.criar, ['/Create', '/TN', 'monitor-rocky', '/XML', 'C:\\x.xml', '/F']);
  assert.deepEqual(c.remover, ['/Delete', '/TN', 'monitor-rocky', '/F']);
  assert.deepEqual(c.consultar, ['/Query', '/TN', 'monitor-rocky']);
  assert.deepEqual(c.encerrar, ['/End', '/TN', 'monitor-rocky']);
});

test('XML: prioridade da tarefa dentro de Settings, padrão 3 e validação 0-10', () => {
  assert.match(montarTarefaXml({ ...opc, prioridade: 6 }), /<Settings>[\s\S]*<Priority>6<\/Priority>[\s\S]*<\/Settings>/);
  assert.match(montarTarefaXml(opc), /<Priority>3<\/Priority>/);
  assert.match(montarTarefaXml({ ...opc, prioridade: 0 }), /<Priority>0<\/Priority>/);
  for (const ruim of [11, -1, 2.5, 'x']) assert.throws(() => montarTarefaXml({ ...opc, prioridade: ruim }), /prioridade/i);
});

test('VBS espera o vigia terminar: a tarefa fica "em execução" e /End derruba a árvore', () => {
  assert.match(montarVbs({ node: 'n.exe', vigia: 'v.js', raiz: 'C:\\r' }), /, 0, True\r?\n$/);
});

const R = 'C:\\GitHub\\monitor-rocky';
const proc = (pid, ppid, nome, linha = '') => ({ pid, ppid, nome, linha });

test('processosDoMonitor: vigia, monitor e ffmpeg da árvore; ignora outros node e outras pastas', () => {
  const lista = [
    proc(1, 0, 'explorer.exe'),
    proc(10, 1, 'wscript.exe', `wscript.exe //B "${R}\\logs\\iniciar-oculto.vbs"`),
    proc(11, 10, 'node.exe', `"C:\\node.exe" "${R}\\src\\vigia.js"`),
    proc(12, 11, 'node.exe', `"C:\\node.exe" ${R}\\src\\principal.js`),
    proc(13, 12, 'ffmpeg.exe', 'ffmpeg -f dshow ...'),
    proc(14, 12, 'ffmpeg.exe', 'ffmpeg -ss 1 clipe'),
    proc(20, 1, 'node.exe', 'node outro.js'),
    proc(21, 1, 'node.exe', `"C:\\node.exe" "${R}\\.claude\\worktrees\\x\\src\\vigia.js"`),
    proc(30, 1, 'ffmpeg.exe', 'ffmpeg de outro programa'),
  ];
  assert.deepEqual(processosDoMonitor(lista, R).sort((a, b) => a - b), [10, 11, 12, 13, 14]);
});

test('processosDoMonitor: monitor órfão (vigia já morreu) e ffmpeg dele também saem; comparação sem caixa e com /', () => {
  const lista = [
    proc(12, 99, 'NODE.EXE', `node ${R.replace(/\\/g, '/')}/src/principal.js`),
    proc(13, 12, 'ffmpeg.exe'),
  ];
  assert.deepEqual(processosDoMonitor(lista, R.toLowerCase()).sort((a, b) => a - b), [12, 13]);
  assert.deepEqual(processosDoMonitor([], R), []);
});
