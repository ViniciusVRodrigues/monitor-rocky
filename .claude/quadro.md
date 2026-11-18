# Quadro — monitor-rocky

## A fazer
| Cartão | Título | Modelo | Depende de |
|---|---|---|---|
| ROCKY-6 | Avisos no celular por web push (change `avisos-web-push`, issue #32); proposto em 2026-11-18, começa pelo plano (iPhone instalado na tela inicial, Tailscale Serve HTTPS) | Opus | ROCKY-2, ROCKY-4 |
| ROCKY-16 | Teste de clipes com ffmpeg real estoura o tempo sob carga (change `teste-clipes-sob-carga`, issue #33); proposto em 2026-11-18, em paralelo ao ROCKY-6 | Sonnet | — |

## Fazendo
- **ROCKY-4: acesso pelo Tailscale** (Opus) — change `acesso-tailscale`, issue #18. Código no main pelo PR #22 (2026-11-18, 249 testes, QA aprovou): `recusaTailscale` (pedido de fora sem `Tailscale-User-Login` dá 403; lista `tailscaleLoginsPermitidos` vazia libera a tailnet), `npm run tailscale -- ligar|desligar|estado` só com Serve e recusa com Funnel, README "Acesso de fora". Em 2026-11-18: Tailscale instalado no PC (máquina "rocky", Serve ligado, Funnel desligado), página abre pelo endereço da tailnet com login exigido; sem convidado por enquanto. Falta só a 4.1: a pessoa abrir pelo celular fora de casa (ao vivo, som, atraso). Não arquivar a change antes.

## Feito
- **ROCKY-9: retenção dos clipes por espaço em disco** (2026-11-18) — PR #31, issue #27 fechada, change arquivada (spec `deteccao`), 285 testes. `limparPorEspaco`: `clipesMaxGb` e `discoLivreMinGb` (0 = desligadas) apagam os dias de clipes mais antigos; poupa hoje, `guardados/` e trechos. Monitor reiniciado em 2026-11-18 (estado parado mantido) com `discoLivreMinGb: 20` no `config.local.json` (disco com ~75 GB livres); `clipesMaxGb` segue 0.
- **ROCKY-8: validação estrita dos números da config** (2026-11-18) — PR #30, issue #26 fechada, change arquivada (spec `captura`), 279 testes. `src/validar.js` (`exigirNumero`) em `src/config.js` e `src/deteccao/config.js`: recusa `true`, `[5]`, `"5"`, `null`, `NaN`, `Infinity`, com a chave e o valor na mensagem. Vale no monitor real no próximo reinício.
- **ROCKY-15: clipes sem travar o event loop** (2026-11-18) — PR #29, issue #25 fechada, change arquivada (spec `deteccao`), 274 testes. `acharTrechos` descarta trechos fora da janela antes do ffprobe, `clipeSondagensSimultaneas` 3, `clipeSondagemTimeoutSegundos` 15. Medido (160 trechos): busca de 5-6,5 s para 0,2 s. Chaves do Tailscale no `config.json`. Vale no monitor real no próximo reinício.
- **ROCKY-13: ajustes da página** (2026-11-18) — PR #28, issue #21 fechada, change arquivada (spec `pagina`), 272 testes. Um só aviso de som (botão "Toque para ouvir o Rocky"); `recuperou` zera e chama `play()` depois de recuperar (hls.js 1.7.4); zoom 200% e modo gravação; opção C da pessoa: linha do tempo recolhível num trilho, lembrada pelo aparelho (1920×1080 recolhida: vídeo 1671×940). Falta: recolher uma vez no ARZOPA; validar no navegador real o primeiro toque do som e a recuperação do HLS.
- **ROCKY-12: estabilidade fina** (2026-11-18) — PR #24, issue #20 fechada, change arquivada (spec `rodar-sozinho`), 257 testes. O vigia aplica `tarefaPrioridade` a si e ao monitor (o Agendador só dava ao wscript); o VBS espera o vigia e o vigia sai quando o pai some; `remover-servico` acha vigia, monitor e ffmpeg pela linha de comando; aviso de rename do HLS silenciado com contagem (leitor ou antivírus segurando o playlist); `--test-force-exit`. Falta: `npm run instalar-servico` na tarefa real (reinicia o monitor), quando a pessoa quiser. Picos do event loop: causa em `src/deteccao/clipes.js` `acharTrechos`, foi para o ROCKY-15.
- **ROCKY-7: timeout no recorte de clipe** (2026-11-18) — PR #23, issue #19 fechada, change arquivada (spec `deteccao`), 252 testes. `clipeTimeoutSegundos` (120; 0 = sem limite) mata o ffmpeg do recorte e da miniatura e a fila segue. Teste intermitente era `test/deteccao-pipe.test.js:28` (espera fixa de 50 ms): corrigido esperando a condição, 32 rodadas sob carga verdes.
- **ROCKY-14: apagar e guardar gravações** (2026-11-17) — PR #16 e #17, issue #15 fechada, 231 testes. Apagar a hora (clipes, eventos e trechos, menos o trecho gravando; confirmação com a contagem) e um a um; "Guardar" em `gravacoes/guardados/` (fora da limpeza); abas [Linha do tempo | Guardados]; botões sempre à vista (ao lado a 768 px). Escolhas da pessoa: opção 1, A e A, manter 768. Falta: conferir no monitor real (tarefa 4.2, monitor parado por escolha da pessoa) e arquivar a change.
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

- Manter o app próprio (2026-11-18): pesquisa de alternativas (Agent DVR, Frigate, Viseron, motionEye, Scrypted) não achou nenhuma que libere a câmera mantendo o som, junte 4 h contínuas com clipes de som e rode nativo no Windows com webcam USB sem nuvem paga.

- Avisos no celular por notificação do navegador (web push), não Telegram (2026-11-18).

## Em aberto
- Por quanto tempo guardar os clipes de evento (padrão provisório: 30 dias, configurável).
