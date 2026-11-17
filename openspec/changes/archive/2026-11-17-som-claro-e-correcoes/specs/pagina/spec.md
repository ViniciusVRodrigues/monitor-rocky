## ADDED Requirements

### Requirement: Som do site com ganho configurável
O som ao vivo da página SHALL passar por um ganho em dB vindo da config (`ouvirGanhoDb`), seguido de um compressor que evita estouro, no modo PCM e no modo MP3.

#### Scenario: Sala quieta
- **WHEN** o microfone capta um som baixo, como um coçar ou um choro
- **THEN** a página toca esse som com o ganho da config aplicado, audível sem aumentar o volume do sistema

#### Scenario: Pico alto
- **WHEN** chega um som forte, como um latido perto do microfone
- **THEN** o compressor limita a saída e o som não distorce

### Requirement: Voltar ao ao vivo
Ao clicar em "Voltar ao ao vivo" depois de tocar uma gravação, a página SHALL recriar o player do ao vivo e mostrar o selo AO VIVO, sem tela de erro presa.

#### Scenario: Volta depois de uma gravação
- **WHEN** a pessoa toca um trecho da linha do tempo e clica em "Voltar ao ao vivo"
- **THEN** o ao vivo volta a tocar em poucos segundos, com o selo e sem os controles da gravação
