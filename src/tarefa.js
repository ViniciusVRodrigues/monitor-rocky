/**
 * Montagem (funções puras) da tarefa agendada do Windows que sobe o vigia no
 * logon do usuário. Tarefa e não serviço: serviços rodam na sessão 0 e não
 * enxergam a câmera nem mostram toast; a tarefa de logon roda na sessão do
 * usuário (LogonType=InteractiveToken).
 */

export function escaparXml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function montarTarefaXml({ usuario, vbs, descricao = 'Monitor Rocky', prioridade = 3 }) {
  if (!Number.isInteger(prioridade) || prioridade < 0 || prioridade > 10) {
    throw new Error(`tarefaPrioridade inválida (${prioridade}): use um inteiro de 0 a 10.`);
  }
  const u = escaparXml(usuario);
  return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>${escaparXml(descricao)}</Description>
  </RegistrationInfo>
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
      <UserId>${u}</UserId>
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>${u}</UserId>
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <StartWhenAvailable>true</StartWhenAvailable>
    <Priority>${prioridade}</Priority>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <RestartOnFailure>
      <Interval>PT1M</Interval>
      <Count>999</Count>
    </RestartOnFailure>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>wscript.exe</Command>
      <Arguments>//B //Nologo ${escaparXml(`"${vbs}"`)}</Arguments>
    </Exec>
  </Actions>
</Task>
`;
}

/** VBScript que sobe o vigia com a janela oculta (estilo 0) e espera ele terminar (a tarefa fica "em execução": `schtasks /End` derruba a árvore). */
export function montarVbs({ node, vigia, raiz }) {
  const q = (s) => String(s).replace(/"/g, '""');
  return `Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "${q(raiz)}"
sh.Run """${q(node)}"" ""${q(vigia)}"" ""--sob-tarefa""", 0, True
`;
}

export function comandosSchtasks(nome, arquivoXml) {
  return {
    criar: ['/Create', '/TN', nome, '/XML', arquivoXml, '/F'],
    remover: ['/Delete', '/TN', nome, '/F'],
    consultar: ['/Query', '/TN', nome],
    encerrar: ['/End', '/TN', nome],
  };
}

/**
 * Dos processos do Windows ({ pid, ppid, nome, linha }), quais pertencem a ESTE monitor:
 * o wscript que sobe o vigia, o vigia, o monitor (principal.js) e tudo que descende deles
 * (ffmpeg, ffprobe). Só conta o que roda a partir de `raiz` (outro checkout não entra).
 * Serve ao `remover-servico`, que não deve deixar node nem ffmpeg órfão.
 */
export function processosDoMonitor(lista, raiz) {
  const norm = (s) => String(s ?? '').toLowerCase().replace(/\\/g, '/');
  const base = norm(raiz).replace(/\/+$/, '');
  const ehRaiz = (p) => {
    const l = norm(p.linha);
    const n = norm(p.nome);
    if (n === 'node.exe') return l.includes(`${base}/src/vigia.js`) || l.includes(`${base}/src/principal.js`);
    if (n === 'wscript.exe') return l.includes(`${base}/`) && l.includes('iniciar-oculto.vbs');
    return false;
  };
  const alvo = new Set(lista.filter(ehRaiz).map((p) => p.pid));
  let cresceu = true;
  while (cresceu) {
    cresceu = false;
    for (const p of lista) {
      if (!alvo.has(p.pid) && alvo.has(p.ppid)) { alvo.add(p.pid); cresceu = true; }
    }
  }
  return [...alvo];
}
