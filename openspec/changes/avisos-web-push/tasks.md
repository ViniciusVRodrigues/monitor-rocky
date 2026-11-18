## 1. Plano
- [ ] 1.1 Pesquisar web push atual (VAPID, biblioteca `web-push` ou implementação própria, Safari/iOS 16.4+ com página instalada, Chrome Android) e fechar o plano com a skill `planejar` (e `ux-ui` para o botão, a explicação do iPhone e o estado dos avisos). Decisões de gosto e de regra (quando avisar, horário de silêncio) vão à coordenadora.

## 2. Servidor
- [ ] 2.1 Chaves VAPID geradas por script e guardadas fora do git; inscrições guardadas fora do git; chaves de config validadas e documentadas.
- [ ] 2.2 Rotas de inscrever e cancelar, atrás de `recusaTailscale`; testes.
- [ ] 2.3 Regra de aviso ligada aos eventos de som (limiar, duração, intervalo mínimo), com testes de envio por cliente falso; inscrição expirada (404/410) é apagada.

## 3. Página
- [ ] 3.1 Manifest, ícone e service worker; botão de ativar avisos com estados (sem suporte, bloqueado, ativo); explicação do iPhone (instalar na tela inicial).
- [ ] 3.2 Tocar no aviso abre a página no evento.

## 4. Entrega
- [ ] 4.1 Conferido que nada passa a ser público (Serve só tailnet, sem Funnel; rotas novas exigem login).
- [ ] 4.2 Aviso recebido de verdade no celular da pessoa pela tailnet (Android e, se houver, iPhone com a página instalada).
