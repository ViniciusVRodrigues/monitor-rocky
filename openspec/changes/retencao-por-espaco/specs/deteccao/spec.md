## ADDED Requirements

### Requirement: Retenção dos clipes por espaço
Quando `clipesMaxGb` ou `discoLivreMinGb` são maiores que zero, o sistema SHALL apagar os dias de clipes mais antigos (pasta e `.jsonl`) até a pasta de clipes ficar abaixo de `clipesMaxGb` e o disco ter pelo menos `discoLivreMinGb` livres, sem tocar no dia de hoje nem em `gravacoes/guardados/`.

#### Scenario: Pasta de clipes acima do limite
- **WHEN** `clipesMaxGb` é 5 e os clipes somam 6 GB em 10 dias
- **THEN** os dias mais antigos são apagados até a soma ficar abaixo de 5 GB, e hoje fica

#### Scenario: Limites desligados
- **WHEN** as duas chaves são 0
- **THEN** a retenção segue só por `clipesDias`
