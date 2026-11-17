# Quadro — monitor-rocky

## A fazer
| Cartão | Título | Modelo | Depende de |
|---|---|---|---|
| ROCKY-4 | Acesso remoto: Cloudflare Tunnel (cloudflared como serviço) + Cloudflare Access com Google; servidor valida o JWT do Access | Opus (segurança) | ROCKY-3 |
| ROCKY-6 | Avisos no celular quando ele late/chora muito (push ou Telegram) | Opus | ROCKY-2, ROCKY-4 |

## Fazendo
- **ROCKY-2 (#4): detecção de eventos** (Opus) — sessão iniciada em 2026-11-17.
- **ROCKY-3 (#5): servidor e página web** (Opus) — sessão iniciada em 2026-11-17.
- **ROCKY-5 (#6): rodar sozinho no Windows** (Sonnet) — sessão iniciada em 2026-11-17.

## Feito
- **ROCKY-1: captura e gravação** (2026-11-17) — PR #2 e #3 (change arquivada em `openspec/specs/captura`), issue #1 fechada, 56 testes. Estados gravando/só som/parado, controle por pipe (`npm run iniciar|parar|estado|camera|ouvir`), distribuidor de PCM ao vivo. Câmera DirectShow é exclusiva: liberar é pelo só som. Falta conferir com a pessoa o "ouvir no PC" nas caixas reais.
- **ROCKY-0: workspace** (2026-11-17) — repositório público, OpenSpec, README, CLAUDE.md, quadro.

## Decisões da pessoa (2026-11-17)
- Domínio: `rocky.vvr.dev.br` (zona `vvr.dev.br` já está na Cloudflare). O túnel e o Access se configuram pelo Chrome da pessoa (ela loga na Cloudflare).
- Ordem: fazer o app inteiro local primeiro; o ROCKY-4 (subir) fica por último.
- Gravação contínua: só as últimas **4 horas** (buffer circular). Eventos viram **clipes** guardados à parte (alguns segundos antes e depois), com retenção própria maior.
- Controle fácil: iniciar, parar e desligar só a câmera (segue o som), para poder usar a câmera em outros apps; tentar compartilhar a câmera sem desligar. Botões na página no ROCKY-3. Liberar a câmera é só por botão (sem agenda).
- Tudo configurável (config.json + config.local.json), nada fixo no código.
- Ouvir o som ao vivo, ligável: no site (pouco atraso) e nas caixas do PC.

## Em aberto
- Quais e-mails Google podem ver (além do da pessoa).
- Por quanto tempo guardar os clipes de evento (padrão provisório: 30 dias, configurável).
