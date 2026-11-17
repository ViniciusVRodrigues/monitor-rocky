## ADDED Requirements

### Requirement: Player estável
A página SHALL recriar o player do ao vivo só quando o estado da captura muda (gravando, só som, parado) ou quando a pessoa pede, e não a cada evento ou reconexão do SSE.

#### Scenario: SSE reconecta
- **WHEN** o SSE reconecta ou manda o mesmo estado de novo
- **THEN** o vídeo continua tocando sem recarregar

### Requirement: Vídeo ocupa a tela
O vídeo do ao vivo SHALL ocupar a maior área possível mantendo a proporção, em 390, 768, 1280 e 1920 px de largura, sem rolagem horizontal, com os controles e a linha do tempo acessíveis.

#### Scenario: Monitor largo
- **WHEN** a página abre em 1920 px
- **THEN** o vídeo usa a largura disponível ao lado ou acima do resto, sem ficar numa coluna estreita

### Requirement: Barra de nível visível
A barra de nível SHALL mexer com o som de um quarto quieto e com fala próxima, com piso e escala configuráveis.

#### Scenario: Pessoa fala perto do microfone
- **WHEN** alguém fala perto do microfone
- **THEN** a barra sobe visivelmente e volta quando o som para
