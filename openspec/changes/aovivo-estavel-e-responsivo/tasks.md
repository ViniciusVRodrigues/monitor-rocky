## 1. Prioridade e CPU (causa raiz)
- [ ] 1.1 Teste: o XML da tarefa traz `<Priority>` da config (`tarefaPrioridade`).
- [ ] 1.2 Teste: o supervisor ajusta a prioridade do ffmpeg (`ffmpegPrioridade`) logo após o spawn; falha ao ajustar só gera log.
- [ ] 1.3 Teste: a câmera abre em `fpsCamera` igual ao `fps` de saída por padrão (sem decodificar quadros descartados).

## 2. Saídas que não seguram a captura
- [ ] 2.1 Teste: o supervisor junta o stderr em linhas inteiras e limita o log por intervalo (resume os repetidos).
- [ ] 2.2 Teste: o vigia grava o log sem bloquear (escrita assíncrona com limite).

## 3. Página
- [ ] 3.1 Teste: o player usa hls.js quando há MSE (nativo só sem MSE) e só é recriado quando o estado da captura muda ou a pessoa pede.
- [ ] 3.2 Barra de nível com piso e escala que mexem num quarto quieto (chaves documentadas).
- [ ] 3.3 Layout responsivo (plano do ux-ui) em 390, 768, 1280 e 1920 px, conferido com prints.

## 4. Aceite
- [ ] 4.1 Suíte de testes verde.
- [ ] 4.2 30 min na câmera real com a página aberta, sem "frame dropped" e sem reinício do ffmpeg.
- [ ] 4.3 Barra de som mexe e o som do site sai alto e claro.
