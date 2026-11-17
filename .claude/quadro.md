# Quadro — monitor-rocky

## A fazer
| Cartão | Título | Modelo | Depende de |
|---|---|---|---|
| ROCKY-1 | Captura e gravação: ffmpeg (DirectShow) grava câmera + microfone em trechos MP4 com retenção; config de dispositivos; script que lista os dispositivos | Sonnet | — |
| ROCKY-2 | Detecção de eventos: movimento e som (latido/choro) com limiar configurável, miniatura e registro em JSON | Opus | ROCKY-1 |
| ROCKY-3 | Servidor e página web: ao vivo (HLS), linha do tempo do dia com eventos, reprodução dos trechos; só 127.0.0.1; responsivo para celular | Opus (tem tela) | ROCKY-1 |
| ROCKY-4 | Acesso remoto: Cloudflare Tunnel (cloudflared como serviço) + Cloudflare Access com Google; servidor valida o JWT do Access | Opus (segurança) | ROCKY-3 |
| ROCKY-5 | Rodar sozinho: iniciar com o Windows, reiniciar se cair, alerta quando a câmera some | Sonnet | ROCKY-1 |
| ROCKY-6 | Avisos no celular quando ele late/chora muito (push ou Telegram) | Opus | ROCKY-2, ROCKY-4 |

## Fazendo

## Feito
- **ROCKY-0: workspace** (2026-11-17) — repositório público, OpenSpec, README, CLAUDE.md, quadro.

## Decisões em aberto (da pessoa)
- Domínio na Cloudflare para o túnel (ex.: `rocky.<seu-domínio>`).
- Quais e-mails Google podem ver.
- Quantos dias guardar de gravação (disco).
