## 1. Retenção por espaço
- [x] 1.1 Testes: com `clipesMaxGb` excedido, apaga os dias mais antigos até ficar abaixo; não apaga hoje nem `guardados/`.
- [x] 1.2 Testes: com `discoLivreMinGb` e pouco espaço livre (espaço livre falso injetado), apaga os dias mais antigos; com `0`, nada muda.
- [x] 1.3 Implementar (espaço livre por `fs.statfs`), com as chaves validadas, no `config.json` e no README.
- [x] 1.4 Log de cada limpeza por espaço, com quantos dias e quantos GB.
