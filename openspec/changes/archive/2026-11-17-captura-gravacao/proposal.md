Issue: https://github.com/ViniciusVRodrigues/monitor-rocky/issues/1

## Why

O monitor precisa, antes de tudo, capturar câmera e microfone do PC e guardar as últimas horas. É a base de que dependem a detecção de eventos (ROCKY-2), a página web (ROCKY-3) e o rodar sozinho (ROCKY-5).

## What Changes

- Projeto Node >= 20 (ESM, sem build), `package.json` com `npm test` (`node --test`).
- Configuração em `config.json` (padrões, versionado) + `config.local.json` (local, no `.gitignore`), com nomes dos dispositivos DirectShow, pasta de gravações, duração do trecho e horas de buffer.
- Script `npm run dispositivos` que lista as câmeras e microfones DirectShow.
- Processo de captura: um único ffmpeg abre câmera + microfone e gera duas saídas: trechos MP4 e HLS ao vivo.
- Buffer circular: apaga trechos mais velhos que o limite (padrão 4 h).
- Reinício do ffmpeg se ele cair, com espera crescente.

## Capabilities

### New Capabilities
- `captura`: captura dos dispositivos, gravação em trechos, HLS ao vivo, buffer circular e configuração.

### Modified Capabilities

## Impact

Código novo em `src/` e `scripts/`; depende do `ffmpeg` no PATH. Define a estrutura de pastas de `gravacoes/` que ROCKY-2 e ROCKY-3 consomem.
