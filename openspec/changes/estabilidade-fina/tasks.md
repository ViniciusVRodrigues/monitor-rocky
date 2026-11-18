## 1. Tarefa e vigia
- [x] 1.1 Teste e correção: o node da tarefa fica na prioridade de `tarefaPrioridade`. Causa medida: o Agendador só dá a prioridade ao wscript; o node nasce Normal. O vigia aplica a faixa a si e ao monitor (`prioridadeDaTarefa`, `src/prioridade.js`).
- [x] 1.2 Teste e correção: `npm run remover-servico` e o fim da tarefa derrubam o vigia e os filhos. `/End` mata só o wscript: o vigia agora espera o pai e sai quando ele some (`vigiarPai`, `--sob-tarefa`); o remover acha vigia, monitor e ffmpeg pela linha de comando (`processosDoMonitor`).

## 2. HLS e testes
- [x] 2.1 Aviso "failed to rename index.m3u8.tmp": no Windows o rename falha enquanto outro programa mantém o playlist aberto; o hls reescreve a cada segmento e se corrige. Silenciado no supervisor, com contagem e motivo no log.
- [x] 2.2 Encerramento da suíte: não reproduzido (a suíte sai na hora, 13-19 s no total com a máquina carregada). `npm test` ganhou `--test-force-exit` como trava.

## 3. Event loop
- [x] 3.1 Causa dos picos: `acharTrechos` em `src/deteccao/clipes.js` roda um ffprobe por trecho do dia, todos de uma vez (`Promise.all`); no Windows cada spawn bloqueia o loop. Medido: 240 ffprobe simultâneos = loop parado ~15 s (5 = 0,5 s). Correção fica para o ROCKY-7/depois (arquivo dele): filtrar trechos que terminam antes da janela e limitar a concorrência a 2-4.
