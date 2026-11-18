## ADDED Requirements

### Requirement: Um só aviso de som
Quando o navegador bloqueia o som, a página SHALL mostrar um único aviso para ativá-lo, nunca dois ao mesmo tempo.

#### Scenario: Som bloqueado ao abrir
- **WHEN** a página abre e o navegador bloqueia o som
- **THEN** aparece um único aviso para ativar o som, o botão grande "Toque para ouvir o Rocky", e nada escurece o vídeo

### Requirement: Recuperação do player repetível
O player SHALL voltar a poder se recuperar de erro de mídia depois que o vídeo volta a tocar.

#### Scenario: Dois erros de mídia separados
- **WHEN** acontece um erro de mídia, o vídeo volta a tocar e depois acontece outro erro de mídia
- **THEN** o player tenta recuperar nas duas vezes

#### Scenario: Recuperou e não voltou a tocar
- **WHEN** o player recupera um erro de mídia e o vídeo não volta a tocar no prazo de `aovivoConectarSegundos`
- **THEN** a página mostra o erro com nova tentativa, em vez de ficar parada

### Requirement: Modo gravação e zoom
Em zoom de 200% (e em tela deitada abaixo de 1024 px) o vídeo SHALL caber inteiro na altura, abaixo do cabeçalho. No modo gravação, a faixa com "Voltar ao ao vivo" SHALL ficar visível abaixo do cabeçalho, com no máximo 2 linhas de texto; abaixo de 600 px ela SHALL ficar acima do vídeo, sem cobri-lo; numa gravação só de som os controles do vídeo SHALL ficar visíveis.

#### Scenario: Gravação a partir da lista rolada
- **WHEN** a pessoa toca num evento com a lista rolada, em zoom de 200%
- **THEN** o player aparece abaixo do cabeçalho e o "Voltar ao ao vivo" fica inteiro visível
