## 1. Som do site alto e claro
- [x] 1.1 Teste: o ganho em dB vira um fator linear e é aplicado no PCM e no MP3. O compressor fica entre o ganho e a saída.
- [x] 1.2 Chave `ouvirGanhoDb` (padrão que deixe o som de uma sala quieta audível, por exemplo +18 dB) documentada no config.
- [x] 1.3 Taxa do ouvir configurável e padrão mais alto (24k ou 32k). A detecção continua medindo os mesmos dB (com teste).
- [x] 1.4 Ganho opcional no ouvir no PC (`ouvirPcGanhoDb` → `-af volume=`), com teste dos args.
- [x] 1.5 Conferir no navegador que o som sai mais alto, sem estourar num pico.

## 2. Voltar ao ao vivo
- [x] 2.1 Reproduzir o defeito no navegador: abrir uma gravação na linha do tempo e clicar em "Voltar ao ao vivo".
- [x] 2.2 Teste e correção: o player volta tocando o ao vivo, com o selo AO VIVO e sem tela de erro presa.

## 3. Processos presos na checagem de saúde
- [x] 3.1 Teste: a checagem de dispositivos que não responde no tempo configurado (`saudeTimeoutMs`) mata o ffmpeg e conta como falha de checagem, não como sumiço.
- [x] 3.2 Conferir com o monitor rodando que não sobra nenhum `ffmpeg -list_devices`.

## Notas da implementação
- Padrões: `ouvirHz` 24000 (era 16000), `ouvirGanhoDb` 18, compressor -18 dB / joelho 12 / razão 12, `ouvirPcGanhoDb` 18 (ffplay `-af volume,alimiter`), `saudeTimeoutMs` 10000.
- 2.1: o defeito não reproduziu por cliques reais (nativo e hls.js, 375 e 800 px). Endurecido o que podia travar: relógio `aovivoConectarSegundos` (15) para "Conectando…" que nunca toca, e o som ao vivo do site pausa enquanto toca uma gravação (antes os dois áudios se misturavam) e volta com o ao vivo.
