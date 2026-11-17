## Why

O ao vivo cai e a linha do tempo sai picada. Medido em 2026-11-17: o ffmpeg não reinicia; ele passa fome de CPU. A tarefa agendada `monitor-rocky` não define prioridade, então o Windows usa o padrão 7 (abaixo do normal), herdado pelo vigia, pelo Node e pelo ffmpeg. Com a máquina carregada (12 núcleos a 1088%, um teste e2e de outro projeto usando 7), o ffmpeg ficou com 1% de um núcleo e o buffer da câmera encheu até "frame dropped". O ffmpeg sozinho, com os mesmos argumentos, rodou 5 min sem perder quadro. Além disso, a câmera abre a 30 fps e o vídeo sai a 15 (decodifica o dobro do necessário), a página recarrega o player a cada 20 s, a barra de som fica vazia num quarto quieto (piso -60 dB, microfone medindo -77 dB) e o vídeo fica numa coluna estreita em vez de ocupar a tela.

Issue: https://github.com/ViniciusVRodrigues/monitor-rocky/issues/13

## What Changes

- Prioridade configurável: a tarefa agendada sobe em prioridade normal e o ffmpeg de captura em prioridade acima do normal (chaves no config, documentadas).
- Menos CPU por quadro: a câmera abre na taxa que o vídeo usa (configurável), sem decodificar quadros que serão descartados.
- As saídas do ffmpeg para o Node (PCM e quadros de movimento) e o log do stderr nunca seguram a captura: leitura sempre drenada, log em linhas inteiras e com limite.
- A página não recria o player a cada evento do SSE: só quando o estado da captura muda de verdade.
- Barra de nível que mexe com som de quarto quieto (piso e escala configuráveis) e som do site alto e claro.
- Layout responsivo: o vídeo ocupa o máximo da área em 390, 768, 1280 e 1920 px.

## Impact

- `src/tarefa.js`, `src/supervisor.js`, `src/ffmpeg-args.js`, `src/captura.js`, `src/vigia.js`, `src/servidor/nivel.js`, `web/js/app.js`, `web/js/aovivo.js`, `web/estilo.css`, `web/index.html`, `config.json` e a documentação das chaves.
- A tarefa agendada precisa ser reinstalada (`npm run instalar-servico`) para valer a prioridade nova.
