# Clipes sem travar o event loop (ROCKY-15)

Issue: https://github.com/ViniciusVRodrigues/monitor-rocky/issues/25

## Por quê
O ROCKY-12 achou a causa dos picos de 5,5 s e 2,2 s no event loop: `acharTrechos` em `src/deteccao/clipes.js` lista os trechos de 3 dias de pastas e sonda cada um com ffprobe em `Promise.all` (até ~240 com o buffer de 4 h). No Windows cada spawn bloqueia o loop: 240 simultâneos deixaram o loop parado ~15 s; 5 simultâneos, 0,5 s. O ROCKY-7 também apontou que `sondar` (ffprobe) não tem tempo limite. E as três chaves do ROCKY-4 ficaram só com padrão no código, sem estar no `config.json`.

## O que muda
- Antes de sondar, descartar os trechos que não podem cobrir a janela do clipe (início + `trechoSegundos` < início da janela, ou início > fim).
- Limitar a concorrência das sondagens (chave configurável, padrão 2 a 4).
- Tempo limite no `sondar`, reaproveitando `clipeTimeoutSegundos` ou chave própria.
- Pôr no `config.json` e na tabela do README `tailscaleLoginsPermitidos`, `tailscaleExe` e `tailscaleHttpsPorta`, com os mesmos padrões do código.

## Impacto
Spec `deteccao`. Áreas: `src/deteccao/clipes.js`, `src/deteccao/config.js` (só chaves novas), `config.json`, README (tabela de chaves), `test/deteccao-clipes.test.js`.
