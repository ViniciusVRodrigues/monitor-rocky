## ADDED Requirements

### Requirement: Captura que não trava por saída lenta
A captura SHALL abrir a câmera na taxa de quadros usada pelo vídeo (config) e SHALL manter drenadas as saídas lidas pelo Node (PCM, quadros de movimento, stderr), de modo que uma saída lenta ou um log volumoso não segure o ffmpeg.

#### Scenario: Log volumoso
- **WHEN** o ffmpeg escreve muitos avisos seguidos
- **THEN** o log registra linhas inteiras, com limite por intervalo, e a leitura do stderr não atrasa a captura

#### Scenario: Ao vivo por 30 minutos
- **WHEN** o monitor roda 30 minutos com a página aberta
- **THEN** o ffmpeg não reinicia e o log não mostra "frame dropped"
