## ADDED Requirements

### Requirement: Recorte de clipe com tempo limite
O recorte de cada clipe SHALL ter tempo limite de `clipeTimeoutSegundos`; ao estourar, o sistema SHALL matar o ffmpeg do recorte, registrar a falha no log e seguir com o próximo clipe da fila.

#### Scenario: Recorte travado
- **WHEN** o ffmpeg de um recorte não termina em `clipeTimeoutSegundos`
- **THEN** o processo é morto, o log diz qual clipe falhou e o próximo clipe da fila é recortado
