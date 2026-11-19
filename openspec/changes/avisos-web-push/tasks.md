## 1. Plano
- [x] 1.1 Pesquisa (web-push 3.6.7, VAPID `sub` aceito pela Apple, iOS 16.4+ instalado, Tailscale Serve) e plano fechado; ux-ui planejou o bloco "Avisos no celular". Decisões da pessoa (2026-11-18): aviso na hora (som por 20 s quase seguidos), no máximo 1 a cada 10 min, sem silêncio por padrão; toque abre o ao vivo.

## 2. Servidor (pacote 1)
- [ ] 2.1 Chaves VAPID geradas na primeira subida e inscrições em `gravacoes/avisos/`, fora do git; chaves de config validadas e documentadas.
- [ ] 2.2 Rotas `/api/avisos/{chave,inscrever,cancelar,teste}` atrás de `recusaTailscale` e `controlePermitido`, endpoint só dos serviços de push conhecidos; testes.
- [ ] 2.3 Envio com urgency high, TTL e topic; inscrição 404/410 apagada; testes por cliente falso.

## 3. Gatilho (pacote 2)
- [ ] 3.1 `aoSomLongo` na detecção (uma vez por evento aberto que passa de `avisoSomSegundos`) e `regra.js` (intervalo mínimo, silêncio que cruza a meia-noite), ligados em `principal.js`; testes.

## 4. Página (pacote 3)
- [ ] 4.1 Manifest, ícones (pegada branca sobre azul), `sw.js` (push → showNotification sempre; clique abre o ao vivo ou foca a aba); bloco "Avisos no celular" com os estados do plano do ux-ui (verificando, indisponível aqui, sem suporte, falta instalar no iPhone, pronto, pedindo, bloqueado, ativo, erro, desligados no PC), aviso de teste e desativar; sincroniza a inscrição a cada carga.
- [ ] 4.2 Tocar no aviso abre a página no ao vivo.

## 5. Entrega
- [ ] 5.1 Conferido que nada passa a ser público (Serve só tailnet, sem Funnel; rotas e estáticos novos exigem login de fora).
- [ ] 5.2 (pessoa) Aviso recebido de verdade no celular pela tailnet (Android e, se houver, iPhone com a página instalada).
