# rodar-sozinho Specification

## Purpose
TBD - created by archiving change rodar-sozinho. Update Purpose after archive.
## Requirements
### Requirement: Início automático no logon
O sistema SHALL oferecer `npm run instalar-servico` e `npm run remover-servico`, que criam e removem uma tarefa agendada do Windows disparada no logon do usuário atual, com o nome configurável (`servicoNome`), que executa o vigia sem abrir janela e sem limite de tempo. Instalar de novo SHALL substituir a tarefa existente.

#### Scenario: instalação
- **WHEN** a pessoa roda `npm run instalar-servico`
- **THEN** existe a tarefa agendada com gatilho de logon, executando o vigia oculto

#### Scenario: remoção
- **WHEN** a pessoa roda `npm run remover-servico`
- **THEN** a tarefa deixa de existir; se não existia, o comando avisa e termina sem erro

### Requirement: Vigia reinicia o monitor
O vigia SHALL manter o monitor (`npm start`) rodando: se o processo sair sem ter sido pedido, sobe de novo com espera crescente (dobra até o teto, configurável) e volta ao início depois de um período estável.

#### Scenario: queda do monitor
- **WHEN** o processo do monitor sai com erro
- **THEN** o vigia registra o código e sobe outro após a espera, que dobra a cada queda até o teto

### Requirement: Log em arquivo com rotação
O vigia SHALL gravar a saída do monitor e os próprios eventos em arquivo na pasta configurada (`logPasta`), e rotacionar quando passar de `logMaxMB`, mantendo `logArquivos` arquivos antigos.

#### Scenario: rotação
- **WHEN** o arquivo de log passa do tamanho máximo
- **THEN** ele vira `.1`, os antigos avançam e o que passar da quantidade é apagado

### Requirement: Alerta de câmera ou microfone sumidos
O sistema SHALL detectar que a câmera ou o microfone sumiram quando o ffmpeg falha `alertaFalhasSeguidas` vezes seguidas ou quando o dispositivo configurado não está na lista DirectShow, e SHALL então gravar `saude.json` na pasta de gravações, mostrar um toast do Windows (desligável) e chamar o gancho `aoAlerta` uma vez por mudança de situação (problema e recuperação). Com o estado `parado` não há verificação; com `so-som` a câmera não é verificada.

#### Scenario: câmera some
- **WHEN** a lista de dispositivos não contém a câmera configurada e o estado é `gravando`
- **THEN** `saude.json` marca a câmera como `sumiu`, um toast é mostrado e `aoAlerta` é chamado uma vez

#### Scenario: volta
- **WHEN** o dispositivo reaparece
- **THEN** `saude.json` volta a `ok` e `aoAlerta` recebe o aviso de recuperação

