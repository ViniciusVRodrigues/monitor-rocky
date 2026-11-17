# Quadro — monitor-rocky

## A fazer
| Cartão | Título | Modelo | Depende de |
|---|---|---|---|
| ROCKY-2 | Detecção de eventos: movimento e som (latido/choro) com limiar configurável; recorta clipe do evento (pré e pós) a partir dos trechos, com miniatura e registro em JSON | Opus | ROCKY-1 |
| ROCKY-3 | Servidor e página web: ao vivo (HLS), linha do tempo do dia com eventos, reprodução dos trechos; só 127.0.0.1; responsivo para celular | Opus (tem tela) | ROCKY-1 |
| ROCKY-4 | Acesso remoto: Cloudflare Tunnel (cloudflared como serviço) + Cloudflare Access com Google; servidor valida o JWT do Access | Opus (segurança) | ROCKY-3 |
| ROCKY-5 | Rodar sozinho: iniciar com o Windows, reiniciar se cair, alerta quando a câmera some | Sonnet | ROCKY-1 |
| ROCKY-6 | Avisos no celular quando ele late/chora muito (push ou Telegram) | Opus | ROCKY-2, ROCKY-4 |

## Fazendo
- **ROCKY-1: captura e gravação** (Sonnet) — change `captura-gravacao`, issue #1, sessão `rocky-1-captura` (2026-11-17). Ao fechar, disparar ROCKY-2, ROCKY-3 e ROCKY-5 em paralelo.

## Feito
- **ROCKY-0: workspace** (2026-11-17) — repositório público, OpenSpec, README, CLAUDE.md, quadro.

## Decisões da pessoa (2026-11-17)
- Domínio: `rocky.vvr.dev.br` (zona `vvr.dev.br` já está na Cloudflare). O túnel e o Access se configuram pelo Chrome da pessoa (ela loga na Cloudflare).
- Ordem: fazer o app inteiro local primeiro; o ROCKY-4 (subir) fica por último.
- Gravação contínua: só as últimas **4 horas** (buffer circular). Eventos viram **clipes** guardados à parte (alguns segundos antes e depois), com retenção própria maior.

## Em aberto
- Quais e-mails Google podem ver (além do da pessoa).
- Por quanto tempo guardar os clipes de evento.
