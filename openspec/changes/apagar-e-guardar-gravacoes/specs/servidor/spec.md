## ADDED Requirements

### Requirement: Apagar gravações
O servidor SHALL apagar, a pedido da página, um clipe ou evento, ou todos os clipes e eventos de uma hora de um dia, e SHALL remover as linhas correspondentes do registro de eventos.

#### Scenario: Apagar um clipe
- **WHEN** a página pede para apagar um evento que existe
- **THEN** o vídeo e a miniatura dele somem do disco e o evento sai do `.jsonl`

#### Scenario: Caminho fora de gravacoes
- **WHEN** o pedido traz um id que aponta para fora de `gravacoes/`
- **THEN** o servidor recusa o pedido e não apaga nada

### Requirement: Guardar gravações
O servidor SHALL copiar um trecho ou clipe para a pasta de guardados, que a limpeza de 4 h e a retenção dos clipes nunca apagam.

#### Scenario: Guardado resiste à limpeza
- **WHEN** a limpeza de 4 h roda
- **THEN** nenhum arquivo da pasta de guardados é apagado
