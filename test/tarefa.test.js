import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarTarefaXml, montarVbs, comandosSchtasks, escaparXml } from '../src/tarefa.js';

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
  assert.match(v, /\.Run """C:\\Program Files\\nodejs\\node\.exe"" ""C:\\r\\src\\vigia\.js""", 0, False/);
});

test('comandos schtasks: criar com XML (substitui), remover e consultar', () => {
  const c = comandosSchtasks('monitor-rocky', 'C:\\x.xml');
  assert.deepEqual(c.criar, ['/Create', '/TN', 'monitor-rocky', '/XML', 'C:\\x.xml', '/F']);
  assert.deepEqual(c.remover, ['/Delete', '/TN', 'monitor-rocky', '/F']);
  assert.deepEqual(c.consultar, ['/Query', '/TN', 'monitor-rocky']);
});
