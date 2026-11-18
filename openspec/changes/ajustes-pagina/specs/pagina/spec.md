## ADDED Requirements

### Requirement: Um só aviso de som
Quando o navegador bloqueia o som, a página SHALL mostrar um único aviso para ativá-lo, nunca dois ao mesmo tempo.

#### Scenario: Som bloqueado ao abrir
- **WHEN** a página abre e o navegador bloqueia o som
- **THEN** aparece um único aviso para ativar o som

### Requirement: Recuperação do player repetível
O player SHALL voltar a poder se recuperar de erro de mídia depois que o vídeo volta a tocar.

#### Scenario: Dois erros de mídia separados
- **WHEN** acontece um erro de mídia, o vídeo volta a tocar e depois acontece outro erro de mídia
- **THEN** o player tenta recuperar nas duas vezes
