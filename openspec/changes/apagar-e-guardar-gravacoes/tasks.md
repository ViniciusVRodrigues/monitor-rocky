## 1. Plano
- [ ] 1.1 Rodar a skill planejar e o ux-ui: onde ficam os botões por hora e por item, o fluxo de confirmação e a lista de guardados.

## 2. Servidor
- [ ] 2.1 Rota para apagar um clipe ou evento, que também atualiza o `.jsonl`. Testes de path traversal, de id inexistente e de host não permitido.
- [ ] 2.2 Rota para apagar todos os clipes e eventos de uma hora de um dia.
- [ ] 2.3 Rota para guardar um trecho ou clipe em `gravacoes/guardados/`. A limpeza de 4 h e a retenção nunca tocam nessa pasta (teste).
- [ ] 2.4 Rota que lista os guardados, inclusive os copiados à mão, como `2026-11-17-rocky/`, e permite apagá-los.

## 3. Página
- [ ] 3.1 Botão "Apagar esta hora" e "Apagar" por item, com confirmação que diz quantos itens serão apagados.
- [ ] 3.2 Botão "Guardar" por item e uma seção "Guardados" com tocar e apagar.
- [ ] 3.3 Conferido em 390, 768, 1280 e 1920 px, com foco no teclado e textos em pt-BR.

## 4. Entrega
- [ ] 4.1 Configuração documentada no `README` e no `config.json`.
- [ ] 4.2 Apagar e guardar conferidos de ponta a ponta no monitor real; o player não quebra ao apagar o item que está tocando.
