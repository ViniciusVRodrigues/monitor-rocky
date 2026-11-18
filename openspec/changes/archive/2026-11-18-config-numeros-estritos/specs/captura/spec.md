## ADDED Requirements

### Requirement: Números da configuração estritos
Toda chave numérica da configuração SHALL ser um número JSON finito; o sistema SHALL recusar ao carregar, com mensagem em pt-BR que diz a chave e o valor, booleanos, listas, textos e nulos no lugar de número.

#### Scenario: Booleano no lugar de número
- **WHEN** o `config.local.json` tem `"clipesDias": true`
- **THEN** o monitor não sobe e o erro diz que `clipesDias` precisa ser um número

#### Scenario: Lista no lugar de número
- **WHEN** o `config.local.json` tem `"trechoSegundos": [5]`
- **THEN** o monitor não sobe e o erro diz que `trechoSegundos` precisa ser um número
