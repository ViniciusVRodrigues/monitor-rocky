## ADDED Requirements

### Requirement: Busca de trechos sem travar
Ao montar um clipe, o sistema SHALL sondar só os trechos que podem cobrir a janela do evento, com no máximo `clipeSondagensSimultaneas` sondagens ao mesmo tempo e tempo limite em cada uma.

#### Scenario: Buffer cheio
- **WHEN** há 240 trechos nos últimos 3 dias e um evento de 30 s pede clipe
- **THEN** só os trechos que cobrem a janela são sondados, nunca mais que o limite ao mesmo tempo

#### Scenario: ffprobe travado
- **WHEN** uma sondagem não termina dentro do tempo limite
- **THEN** o processo é morto, a falha vai ao log e a fila de clipes segue
