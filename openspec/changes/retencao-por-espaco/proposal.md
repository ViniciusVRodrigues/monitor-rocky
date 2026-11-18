# Retenção dos clipes por espaço em disco (ROCKY-9)

Issue: https://github.com/ViniciusVRodrigues/monitor-rocky/issues/27

## Por quê
Hoje os clipes são apagados só por idade (`clipesDias`, padrão 30). Num dia agitado, ou com o disco quase cheio, os clipes podem encher o disco antes de vencer o prazo.

## O que muda
- Chave opcional `clipesMaxGb` (padrão `0` = sem limite): quando a pasta `gravacoes/clipes/` passa do limite, apagar os dias mais antigos (clipes e o `.jsonl` do dia) até voltar abaixo.
- Chave opcional `discoLivreMinGb` (padrão `0` = desligada): se o disco da pasta de gravações tiver menos livre que isso, apagar os dias de clipes mais antigos.
- Nunca tocar em `gravacoes/guardados/` nem no dia de hoje; trechos continuam com a limpeza de 4 h.
- Log de cada limpeza por espaço.

## Impacto
Spec `deteccao` (Retenção dos clipes). Áreas: `src/deteccao/registro.js` (`limparClipes`), `src/deteccao/index.js` (chamada), `src/deteccao/config.js` (chaves novas), `config.json`, README, `test/deteccao-registro.test.js`.
