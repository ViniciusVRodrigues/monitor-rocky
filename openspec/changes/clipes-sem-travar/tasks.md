## 1. Busca de trechos
- [x] 1.1 Teste: com 240 trechos em 3 dias e um evento de 30 s, só os trechos que cobrem a janela são sondados.
- [x] 1.2 Teste: nunca há mais sondagens ao mesmo tempo que o limite configurado.
- [x] 1.3 Teste: `sondar` com ffprobe falso que não termina é morto no tempo limite e o clipe segue ou falha com log.
- [x] 1.4 Implementar, com as chaves novas validadas e documentadas.
- [x] 1.5 Medir o atraso do event loop num recorte com o buffer cheio (dados sintéticos): antes e depois, no relatório.

## 2. Config
- [x] 2.1 `tailscaleLoginsPermitidos`, `tailscaleExe` e `tailscaleHttpsPorta` no `config.json` e no README, com os padrões do código.

## Medição (1.5, 2026-11-18, 160 trechos sintéticos em 2 dias, evento de 30 s, 3 rodadas)
- Antes (160 ffprobe em `Promise.all`): 5,0 a 6,5 s para achar os trechos; atraso máx. do loop 21 a 40 ms.
- Depois (filtro + 3 simultâneas, limite 15 s): 0,15 a 0,21 s; atraso máx. do loop 16 a 18 ms.
- O pico de ~15 s do ROCKY-12 não se repetiu nesta máquina em repouso (depende de carga/antivírus); a redução de 160 para ~1 sondagem e o teto de 3 simultâneas cobrem o caso.
