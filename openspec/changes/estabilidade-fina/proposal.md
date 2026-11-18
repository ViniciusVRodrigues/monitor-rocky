# Estabilidade fina (ROCKY-12)

Issue: https://github.com/ViniciusVRodrigues/monitor-rocky/issues/20

## Por quê
Depois do ROCKY-11 o ao vivo ficou estável, mas sobraram arestas vistas no uso real em 2026-11-17: o node da tarefa ficou em prioridade Normal mesmo com `tarefaPrioridade` 3; `schtasks /End` não derrubou o vigia antigo (precisou de taskkill); o hls avisa "failed to rename index.m3u8.tmp"; o harness de testes leva ~3 min para encerrar; o event loop teve picos de 5,5 s e 2,2 s perto de movimento e clipe.

## O que muda
- O node da tarefa roda na prioridade configurada.
- Parar a tarefa ou remover o serviço derruba o vigia e os filhos, sem taskkill à mão.
- Aviso de rename do HLS: achar a causa (antivírus, indexador, leitura concorrente) e corrigir, ou silenciar com motivo escrito.
- Achar o que segura o encerramento dos testes (timers, sockets, processos filhos) e soltar.
- Medir os picos do event loop e apontar a causa com arquivo:linha. Correção que caia em `src/deteccao/` fica para depois do ROCKY-7 (cartão em paralelo): só relatar.
- O `recuperou` do hls.js fica no ROCKY-13 (é `web/`).

## Impacto
Spec `rodar-sozinho`. Áreas: `src/tarefa.js`, `src/prioridade.js`, `src/vigia.js`, `src/supervisor.js`, `scripts/servico.js`, `src/ffmpeg-args.js`, `test/servidor-util.js` e os testes dessas áreas. Fora: `web/`, `src/deteccao/`, `src/servidor/`, `src/config.js`, `config.json` e README (chave nova só se indispensável, no bloco da tarefa).
