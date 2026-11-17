## 1. Prioridade e CPU (causa raiz)
- [x] 1.1 Teste: o XML da tarefa traz `<Priority>` da config (`tarefaPrioridade`).
- [x] 1.2 Teste: o supervisor ajusta a prioridade do ffmpeg (`ffmpegPrioridade`) logo após o spawn; falha ao ajustar só gera log.
- [x] 1.3 Teste: sem `fpsCamera` (null) a câmera abre no `fps` de saída; o `config.json` fica em 30 porque a câmera desta máquina não aceita 15 fps em MJPEG.

## 2. Saídas que não seguram a captura
- [x] 2.1 Teste: o supervisor junta o stderr em linhas inteiras e limita o log por intervalo (resume os repetidos).
- [x] 2.2 Teste: o vigia grava o log sem bloquear (escrita assíncrona com limite).
- [x] 2.3 Clipes com `-c copy` (`clipeCopiar`) e prioridade abaixo do normal (`clipePrioridade`): sem segunda codificação a cada evento.

## 3. Página
- [x] 3.1 Teste: o player usa hls.js quando há MSE (nativo só sem MSE) e só é recriado quando o estado da captura muda ou a pessoa pede.
- [x] 3.2 Barra de nível com piso e escala que mexem num quarto quieto (chaves documentadas).
- [x] 3.3 Layout responsivo (plano do ux-ui) em 390, 768, 1280 e 1920 px, conferido com prints.

## 4. Aceite
- [x] 4.1 Suíte de testes verde.
- [x] 4.2 30 min na câmera real com a página aberta, sem "frame dropped" e sem reinício do ffmpeg (2026-11-17, 16:17–16:48: 0 quedas, 0 reinícios).
- [x] 4.3 Barra de som mexe (medido no teste de 30 min); a clareza do som no site fica para a pessoa confirmar ao ouvir.
