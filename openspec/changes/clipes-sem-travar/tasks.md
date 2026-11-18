## 1. Busca de trechos
- [ ] 1.1 Teste: com 240 trechos em 3 dias e um evento de 30 s, só os trechos que cobrem a janela são sondados.
- [ ] 1.2 Teste: nunca há mais sondagens ao mesmo tempo que o limite configurado.
- [ ] 1.3 Teste: `sondar` com ffprobe falso que não termina é morto no tempo limite e o clipe segue ou falha com log.
- [ ] 1.4 Implementar, com as chaves novas validadas e documentadas.
- [ ] 1.5 Medir o atraso do event loop num recorte com o buffer cheio (dados sintéticos): antes e depois, no relatório.

## 2. Config
- [ ] 2.1 `tailscaleLoginsPermitidos`, `tailscaleExe` e `tailscaleHttpsPorta` no `config.json` e no README, com os padrões do código.
