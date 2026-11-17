## 1. Servidor (pacote P1)

- [ ] 1.1 `config.json`: chaves novas (design, tabela) e validação em `src/config.js`
- [ ] 1.2 `src/servidor/seguranca.js`: host permitido, cabeçalhos, checagem CSRF e Sec-Fetch-Site (testes primeiro)
- [ ] 1.3 `src/servidor/arquivos.js`: resolução segura e Range (testes de traversal primeiro)
- [ ] 1.4 `src/servidor/linha-tempo.js`: dias, trechos (`soAudio`, `emAndamento`), eventos do jsonl
- [ ] 1.5 `src/servidor/controle.js`: ações, 405/403/409/504
- [ ] 1.6 `src/servidor/ao-vivo.js`: SSE com estado, eventos e batida
- [ ] 1.7 `src/servidor/ouvir-site.js`: PCM e MP3 compartilhado (spawn injetado), limite de ouvintes
- [ ] 1.8 `src/servidor/app.js`: `criarServidor({ cfg, monitor, aoEvento, antes })`, rotas e estáticos (`web/`, `/vendor/hls.min.js`)
- [ ] 1.9 `src/principal.js` e `npm start`; `hls.js` 1.7.4 como dependência exata
- [ ] 1.9b `src/servidor/nivel.js` + evento `nivel` no SSE (§8); "Ouvir no PC" desligado ao iniciar
- [ ] 1.10 README: seção do servidor e das chaves novas

## 2. Página (pacote P2)

- [ ] 2.1 `web/estilo.css` com os tokens do plano do ux-ui (claro e escuro)
- [ ] 2.2 `web/index.html` com a estrutura (cabeçalho, ao vivo, Ouvir, controles, dia)
- [ ] 2.3 `web/js/linha-tempo.js` (funções puras: agrupar trechos em blocos, horas vazias, intensidade) com testes em node
- [ ] 2.4 `web/js/ouvir.js` (agendador PCM puro testado + modo MP3 com Media Session)
- [ ] 2.4b Som ligado ao abrir com mute "Silenciar"/"Ativar som", localStorage, aviso "Toque para ouvir o Rocky" (§9); barra de nível (§8)
- [ ] 2.5 `web/js/app.js`: estado/SSE, player HLS, controles com confirmação, dia e navegação, pílula de eventos novos, banner sem conexão

## 3. Conferência e entrega

- [ ] 3.1 Verificador por pacote; leitura dos diffs
- [ ] 3.2 Prints em 390 e 1280 com `fonte: "teste"` e eventos de exemplo
- [ ] 3.3 qa-senior e ux-ui em validação; corrigir bloqueios
- [ ] 3.4 Rebase na main, PR, merge, arquivar a change
- [ ] 3.5 Pendente para a pessoa: testar o Ouvir com a tela apagada num celular real
