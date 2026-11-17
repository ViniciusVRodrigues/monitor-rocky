## ADDED Requirements

### Requirement: Checagem de dispositivos com tempo limite
A checagem de saúde SHALL encerrar o `ffmpeg -list_devices` que passar do tempo da config (`saudeTimeoutMs`) e SHALL tratar isso como falha da checagem, não como dispositivo sumido.

#### Scenario: ffmpeg travado
- **WHEN** o `ffmpeg -list_devices` não termina no tempo limite
- **THEN** o processo é morto e não sobra nenhum ffmpeg da checagem rodando
