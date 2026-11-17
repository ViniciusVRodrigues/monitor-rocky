# Quadro — monitor-rocky

## A fazer
| Cartão | Título | Modelo | Depende de |
|---|---|---|---|
| ROCKY-4 | Acesso remoto por Tailscale (Serve com HTTPS, rede privada; a pessoa e um convidado, celular e PC do trabalho); sem Cloudflare | Opus (segurança) | — |
| ROCKY-6 | Avisos no celular quando ele late/chora muito (push ou Telegram) | Opus | ROCKY-2, ROCKY-4 |
| ROCKY-7 | Timeout no recorte de clipe do ffmpeg (um recorte travado segura a fila) + achar o teste intermitente (1 falha em 3 rodadas no main em 2026-11-17) | Sonnet | — |
| ROCKY-8 | Validação estrita dos números da config (hoje aceita `true` e `[5]`) | Sonnet | — |
| ROCKY-9 | Retenção dos clipes também por espaço em disco (opcional) | Sonnet | — |
| ROCKY-12 | Estabilidade fina: picos do event loop (5,5 s e 2,2 s) perto de movimento e clipe; aviso do hls "failed to rename index.m3u8.tmp"; `recuperou` do hls.js que não zera; harness que leva ~3 min para encerrar; o node da tarefa ficou em prioridade Normal mesmo com `tarefaPrioridade` 3 (o ffmpeg está acima do normal); `schtasks /End` não derrubou o vigia antigo (precisou de taskkill) | Sonnet | — |
| ROCKY-13 | Ajustes da página: avisos de som duplicados ("Toque para ouvir" e "Ativar som"), validar zoom 200% e modo gravação; perguntar à pessoa se o player fica no topo em 1280 | Opus (visual) | — |

## Fazendo

## Feito
- **ROCKY-11: ao vivo estável, som e responsivo** (2026-11-17) — PR #14, issue #13 fechada, 208 testes. Causa: falta de CPU (tarefa em prioridade abaixo do normal, PC carregado) e saídas que seguravam o ffmpeg. `tarefaPrioridade` acima do normal, clipes em `-c copy`, hls.js antes do HLS nativo do Chrome 156, layout responsivo (vídeo fixo no celular, barra de som sobre a base do vídeo). Teste de 31 min na câmera real sem quadro perdido. 720p veryfast; `fpsCamera` 30 (a câmera não abre 720p a 15). Tarefa reinstalada. Som confirmado claro pela pessoa (2026-11-17).
- **ROCKY-10: som claro e correções** (2026-11-17) — PR #12, issue #11 fechada, 185 testes. Som do site com ganho (`ouvirGanhoDb` 18) e compressor, `ouvirHz` 24000, `ouvirPcGanhoDb`, "Voltar ao ao vivo" corrigido, `saudeTimeoutMs` mata o ffmpeg preso. Monitor reiniciado com o código novo. Som confirmado claro pela pessoa.
- **ROCKY-3: servidor e página** (2026-11-17) — PR #10, issue #5 fechada, specs `servidor` e `pagina`, 172 testes. Ao vivo HLS, som ligado com Silenciar, barra de nível, controles com confirmação, linha do tempo. Falta testar no celular real (tela apagada, atraso, Safari/iOS). ROCKY-4: pôr `rocky.vvr.dev.br` em `hostsPermitidos`.
- **Em uso** (2026-11-17) — tarefa `monitor-rocky` instalada (sobe no logon), monitor gravando, página aberta no ARZOPA (Chrome em modo app). Microfone quase mudo (média -90 dB): a pessoa precisa conferir o ganho do fifine e o volume de entrada do Windows.
- **ROCKY-2: detecção de eventos** (2026-11-17) — PR #8 e #9, issue #4 fechada, spec em `openspec/specs/deteccao`, 124 testes. Clipes em `gravacoes/clipes/`, registro em `gravacoes/eventos/*.jsonl`, `aoEvento`. Microfone quase mudo no teste (média -91 dB): conferir o ganho com a pessoa.
- **ROCKY-5: rodar sozinho** (2026-11-17) — PR #7, issue #6 fechada, spec em `openspec/specs/rodar-sozinho`, 71 testes. `npm run instalar-servico`/`remover-servico` (tarefa no logon), vigia com log rotativo, alerta de câmera/mic sumidos com gancho `aoAlerta`.
- **ROCKY-1: captura e gravação** (2026-11-17) — PR #2 e #3 (change arquivada em `openspec/specs/captura`), issue #1 fechada, 56 testes. Estados gravando/só som/parado, controle por pipe (`npm run iniciar|parar|estado|camera|ouvir`), distribuidor de PCM ao vivo. Câmera DirectShow é exclusiva: liberar é pelo só som. Falta conferir com a pessoa o "ouvir no PC" nas caixas reais.
- **ROCKY-0: workspace** (2026-11-17) — repositório público, OpenSpec, README, CLAUDE.md, quadro.

## Decisões da pessoa (2026-11-17)
- Domínio: `rocky.vvr.dev.br` (zona `vvr.dev.br` já está na Cloudflare). O túnel e o Access se configuram pelo Chrome da pessoa (ela loga na Cloudflare).
- Ordem: fazer o app inteiro local primeiro; o ROCKY-4 (subir) fica por último.
- Gravação contínua: só as últimas **4 horas** (buffer circular). Eventos viram **clipes** guardados à parte (alguns segundos antes e depois), com retenção própria maior.
- Controle fácil: iniciar, parar e desligar só a câmera (segue o som), para poder usar a câmera em outros apps; tentar compartilhar a câmera sem desligar. Botões na página no ROCKY-3. Liberar a câmera é só por botão (sem agenda).
- Tudo configurável (config.json + config.local.json), nada fixo no código.
- Ouvir o som ao vivo, ligável: no site (pouco atraso) e nas caixas do PC.

- Acesso de fora: **Tailscale** (2026-11-17), não Cloudflare. Motivo: os termos da Cloudflare restringem vídeo pelo túnel no plano grátis (risco de limitar a conta da zona vvr.dev.br). Duas pessoas ao mesmo tempo: sim (até 6 usuários).

## Em aberto
- Quais e-mails Google podem ver (além do da pessoa).
- Por quanto tempo guardar os clipes de evento (padrão provisório: 30 dias, configurável).
