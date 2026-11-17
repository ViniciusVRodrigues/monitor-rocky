# Quadro — monitor-rocky

## A fazer
| Cartão | Título | Modelo | Depende de |
|---|---|---|---|
| ROCKY-4 | Acesso remoto: Cloudflare Tunnel (cloudflared como serviço) + Cloudflare Access com Google; servidor valida o JWT do Access | Opus (segurança) | ROCKY-3 |
| ROCKY-6 | Avisos no celular quando ele late/chora muito (push ou Telegram) | Opus | ROCKY-2, ROCKY-4 |
| ROCKY-7 | Timeout no recorte de clipe do ffmpeg (um recorte travado segura a fila) + achar o teste intermitente (1 falha em 3 rodadas no main em 2026-11-17) | Sonnet | — |
| ROCKY-8 | Validação estrita dos números da config (hoje aceita `true` e `[5]`) | Sonnet | — |
| ROCKY-9 | Retenção dos clipes também por espaço em disco (opcional) | Sonnet | — |

## Fazendo

## Feito
- **ROCKY-3: servidor e página** (2026-11-17) — PR #10, issue #5 fechada, specs `servidor` e `pagina`, 172 testes. Ao vivo HLS, som ligado com Silenciar, barra de nível, controles com confirmação, linha do tempo. Falta testar no celular real (tela apagada, atraso, Safari/iOS). ROCKY-4: pôr `rocky.vvr.dev.br` em `hostsPermitidos`.
- **ROCKY-2: detecção de eventos** (2026-11-17) — PR #8 e #9, issue #4 fechada, spec em `openspec/specs/deteccao`, 124 testes. Clipes em `gravacoes/clipes/`, registro em `gravacoes/eventos/*.jsonl`, `aoEvento`. Microfone quase mudo no teste (média -91 dB): conferir o ganho com a pessoa.
- **ROCKY-5: rodar sozinho** (2026-11-17) — PR #7, issue #6 fechada, spec em `openspec/specs/rodar-sozinho`, 71 testes. `npm run instalar-servico`/`remover-servico` (tarefa no logon), vigia com log rotativo, alerta de câmera/mic sumidos com gancho `aoAlerta`. A tarefa ainda não foi instalada de verdade (fazer quando o ROCKY-3 entrar).
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
