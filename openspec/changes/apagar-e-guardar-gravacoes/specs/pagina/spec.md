## ADDED Requirements

### Requirement: Apagar e guardar pela linha do tempo
A página SHALL permitir apagar todos os clipes de uma hora, ou um de cada vez, sempre com confirmação. Também SHALL permitir guardar um trecho ou clipe e listar os guardados.

#### Scenario: Confirmação conta o que sai
- **WHEN** a pessoa toca em "Apagar esta hora" numa hora com 5 clipes e 12 trechos já gravados
- **THEN** a confirmação diz "Apagar 5 clipes e 12 trechos das 16h? Não dá para desfazer."
- **AND** o trecho que está gravando agora não entra na contagem

#### Scenario: Apagar a hora
- **WHEN** a pessoa confirma
- **THEN** os clipes, os eventos e os trechos daquela hora somem da linha do tempo e do disco
- **AND** o trecho que está gravando agora e o que está em Guardados continuam

#### Scenario: Cancelar
- **WHEN** a pessoa cancela a confirmação
- **THEN** nada é apagado
