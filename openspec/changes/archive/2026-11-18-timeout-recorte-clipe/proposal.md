# Timeout no recorte de clipe e teste intermitente (ROCKY-7)

Issue: https://github.com/ViniciusVRodrigues/monitor-rocky/issues/19

## Por quê
O recorte do clipe chama o ffmpeg e espera ele terminar. Se um recorte trava, a fila de clipes para inteira. E um teste falhou 1 vez em 3 rodadas no main em 2026-11-17, sem causa conhecida.

## O que muda
- Tempo limite configurável no recorte (`clipeTimeoutSegundos`); ao estourar, o ffmpeg é morto, a falha vai ao log e a fila segue.
- Achar o teste intermitente (rodar a suíte várias vezes), a causa, e corrigir. Se a causa estiver em arquivo de outro cartão em paralelo (`web/`, `src/tarefa.js`, `src/prioridade.js`, `src/vigia.js`, `scripts/servico.js`, `src/ffmpeg-args.js`, `src/servidor/seguranca.js`, `src/servidor/app.js`, `test/servidor-util.js`), só relatar.

## Impacto
Spec `deteccao`. Áreas: `src/deteccao/clipes.js`, `src/deteccao/config.js` (só a chave nova), `config.json` e a linha da chave nova no README, `test/deteccao-clipes.test.js` e o teste intermitente.
