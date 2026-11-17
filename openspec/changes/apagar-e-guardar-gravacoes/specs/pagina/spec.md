## ADDED Requirements

### Requirement: Apagar e guardar pela linha do tempo
A página SHALL permitir apagar todos os clipes de uma hora, ou um de cada vez, sempre com confirmação. Também SHALL permitir guardar um trecho ou clipe e listar os guardados.

#### Scenario: Apagar a hora
- **WHEN** a pessoa toca em "Apagar esta hora" e confirma
- **THEN** os clipes e eventos daquela hora somem da linha do tempo e do disco

#### Scenario: Cancelar
- **WHEN** a pessoa cancela a confirmação
- **THEN** nada é apagado
