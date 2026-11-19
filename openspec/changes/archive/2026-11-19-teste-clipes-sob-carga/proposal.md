# Teste de clipes estável sob carga (ROCKY-16)

Issue: https://github.com/ViniciusVRodrigues/monitor-rocky/issues/33

## Por quê
No ROCKY-9, um teste de `test/deteccao-clipes.test.js` que usa o ffmpeg real estourou o tempo quando várias suítes rodaram juntas; isolado, passa. Teste que falha por carga esconde falha de verdade e atrapalha a entrega dos outros cartões.

## O que muda
- Achar qual teste e por quê (CPU disputada, tempo limite do teste, `clipeTimeoutSegundos` ou do ffprobe curto demais no teste, concorrência do `node --test`).
- Corrigir a causa sem aumentar espera às cegas: por exemplo, dados de entrada menores, tempo limite do teste ligado ao do recorte, ou rodar as suítes de ffmpeg real em série.
- Provar com várias rodadas da suíte inteira com carga.

## Impacto
Spec `deteccao` (só o requisito de teste). Áreas: `test/deteccao-clipes.test.js`, `src/deteccao/clipes.js` se a causa estiver lá, e a linha `test` do `package.json` se a correção for a concorrência. Não toca `src/servidor/`, `web/`, `config.json` nem os outros arquivos de `src/deteccao/` (ROCKY-6).
