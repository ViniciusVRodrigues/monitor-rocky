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

export function montarTarefaXml({ usuario, vbs, descricao = 'Monitor Rocky' }) {
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

/** VBScript que sobe o vigia com a janela oculta (estilo 0) e volta na hora. */
export function montarVbs({ node, vigia, raiz }) {
  const q = (s) => String(s).replace(/"/g, '""');
  return `Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "${q(raiz)}"
sh.Run """${q(node)}"" ""${q(vigia)}""", 0, False
`;
}

export function comandosSchtasks(nome, arquivoXml) {
  return {
    criar: ['/Create', '/TN', nome, '/XML', arquivoXml, '/F'],
    remover: ['/Delete', '/TN', nome, '/F'],
    consultar: ['/Query', '/TN', nome],
  };
}
