Issue: https://github.com/ViniciusVRodrigues/monitor-rocky/issues/4

## Why

O buffer guarda só as últimas 4 h e ninguém assiste tudo. A pessoa quer saber quando o Rocky se mexeu, latiu ou chorou, e rever esses momentos depois, mesmo que já tenham saído do buffer.

## What Changes

- Detecção de **som** (latido/choro) pelo volume (RMS em dBFS) do áudio ao vivo do distribuidor, com limiar e duração mínima configuráveis.
- Detecção de **movimento** por diferença entre quadros cinza de baixa resolução, que o mesmo ffmpeg manda por um pipe nomeado (só no estado `gravando`).
- Agregador de eventos: atividades próximas se juntam; tempo mínimo entre eventos; duração máxima por evento.
- Cada evento vira um **clipe** (pré e pós configuráveis) recortado dos trechos, com **miniatura** e uma linha no **registro do dia** (`gravacoes/eventos/AAAA-MM-DD.jsonl`), guardados fora do buffer.
- Emissor `aoEvento(fn)` para o site mostrar eventos ao vivo.
- Retenção dos clipes por idade (padrão 30 dias, configurável), sem tocar nos trechos.
- `saidasExtras` do ffmpeg passa a poder depender do estado (função).

## Capabilities

### New Capabilities
- `deteccao`: detecção de som e movimento, clipes de evento, registro e retenção.

### Modified Capabilities
- `captura`: `saidasExtras` aceita função do estado; `iniciarMonitor` devolve também `deteccao`.

## Impact

Código novo em `src/deteccao/`; mudanças pequenas em `src/ffmpeg-args.js`, `src/captura.js`, `config.json` e README. Define o contrato de `gravacoes/clipes/` e `gravacoes/eventos/` que o ROCKY-3 lê.
