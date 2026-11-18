# Validação estrita dos números da config (ROCKY-8)

Issue: https://github.com/ViniciusVRodrigues/monitor-rocky/issues/26

## Por quê
A validação usa `Number(x) > 0`, que aceita `true` (vira 1), `[5]` (vira 5) e `"5"`. Um erro de digitação no `config.local.json` passa calado e muda o comportamento.

## O que muda
- Toda chave numérica de `src/config.js` e `src/deteccao/config.js` exige `typeof === 'number'` e `Number.isFinite`; as inteiras exigem `Number.isInteger`.
- Um só ajudante de validação, usado nos dois arquivos, com mensagens em pt-BR que dizem a chave e o valor recebido.
- O `config.json` atual e o `config.local.example.json` seguem válidos.

## Impacto
Spec `captura` (Tudo configurável). Áreas: `src/config.js`, `src/deteccao/config.js`, um ajudante novo (ex.: `src/validar.js`), `test/config.test.js`, `test/deteccao-base.test.js`.
