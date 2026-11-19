## ADDED Requirements

### Requirement: Testes de clipe com ffmpeg real estáveis sob carga
Os testes de clipe que usam o ffmpeg real SHALL passar quando a suíte inteira roda com as demais suítes ao mesmo tempo e com o PC sob carga, sem depender de esperas aumentadas às cegas.

#### Scenario: Suíte inteira sob carga
- **WHEN** `npm test` roda 10 vezes seguidas, algumas com carga de CPU extra
- **THEN** todas as rodadas terminam verdes
