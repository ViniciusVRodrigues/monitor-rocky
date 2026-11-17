## 1. Som do site alto e claro
- [ ] 1.1 Teste: o ganho em dB vira um fator linear e é aplicado no PCM e no MP3. O compressor fica entre o ganho e a saída.
- [ ] 1.2 Chave `ouvirGanhoDb` (padrão que deixe o som de uma sala quieta audível, por exemplo +18 dB) documentada no config.
- [ ] 1.3 Taxa do ouvir configurável e padrão mais alto (24k ou 32k). A detecção continua medindo os mesmos dB (com teste).
- [ ] 1.4 Ganho opcional no ouvir no PC (`ouvirPcGanhoDb` → `-af volume=`), com teste dos args.
- [ ] 1.5 Conferir no navegador que o som sai mais alto, sem estourar num pico.

## 2. Voltar ao ao vivo
- [ ] 2.1 Reproduzir o defeito no navegador: abrir uma gravação na linha do tempo e clicar em "Voltar ao ao vivo".
- [ ] 2.2 Teste e correção: o player volta tocando o ao vivo, com o selo AO VIVO e sem tela de erro presa.

## 3. Processos presos na checagem de saúde
- [ ] 3.1 Teste: a checagem de dispositivos que não responde no tempo configurado (`saudeTimeoutMs`) mata o ffmpeg e conta como falha de checagem, não como sumiço.
- [ ] 3.2 Conferir com o monitor rodando que não sobra nenhum `ffmpeg -list_devices`.
