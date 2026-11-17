# Design: apagar e guardar gravações

## Contrato do servidor (feito, commit 61f4de9)

Todas as rotas de escrita são `POST`, com corpo JSON (até 16 KB), `Content-Type: application/json` e `X-Rocky: 1`, como o `/api/controle`. Respostas:

- Host fora da lista: 421.
- Pedido sem `X-Rocky`, de outro site ou sem JSON: 403.
- Outro método: 405.
- Erro: `{ ok: false, erro: "texto em pt-BR" }`, com o status do erro.

| Rota | Corpo | Resposta 200 | Erros |
|---|---|---|---|
| `POST /api/apagar/evento` | `{ dia: "AAAA-MM-DD", id }` | `{ ok, eventos, arquivos, falhas }` | 400 dia ou id inválido; 404 evento inexistente |
| `POST /api/apagar/hora` | `{ dia, hora: 0..23, ids?: [id...], trechos?: bool }` | `{ ok, eventos, arquivos, trechos, emAndamento, falhas }` | 400 |
| `POST /api/guardar` | `{ urls: ["/arquivos/trechos/..." ou "/arquivos/clipes/..."], rotulo? }` | 201 `{ ok, guardado, pulados }` | 400; 409 só sobrou o trecho em andamento; 500 falha na cópia |
| `GET /api/guardados` | | `{ guardados: [Guardado] }`, mais novos primeiro | |
| `POST /api/guardados/apagar` | `{ nome }` | `{ ok: true }` | 400; 404; 500 sobrou algo |

Regras:

- `ok` é `false` quando `falhas > 0`. O apagar foi parcial, e a página mostra "Apaguei X de Y".
- `apagar/hora` com `ids` apaga só os eventos dessa lista que são daquela hora. Um evento que chegou depois da confirmação não é apagado.
- `trechos: true` apaga também a gravação contínua da hora, menos o trecho em andamento (contado em `emAndamento`).
- `Guardado` = `{ nome, rotulo, criado, arquivos: [{ url, nome, bytes, soAudio }], miniatura, bytes, origens: [url...] }`.
  - `origens` traz as urls de `/arquivos/...` que foram guardadas. A página marca "✓ Guardado" quando a url do clipe (ou todas as urls do bloco) está em alguma `origens`.
  - Pastas copiadas à mão (sem `guardado.json`) aparecem com `rotulo` = nome e `origens` vazio.
- Guardados ficam em `<pasta>/<guardadosPasta>/` (padrão `guardados`). A limpeza de 4 h e a retenção de clipes não olham essa pasta.
- Arquivos guardados são servidos em `/arquivos/guardados/<nome>/<arquivo>.{mp4,jpg}`.

Configuração nova:

- `guardadosPasta`: nome da pasta dos guardados.
- `guardarMaxArquivos`: limite de arquivos por pedido de guardar.
- `apagarHoraTrechos`: o padrão é `true`, e "Apagar esta hora" leva junto a gravação contínua.
- A página recebe `guardarMaxArquivos` e `apagarHoraTrechos` por `/api/config`.

## Página

Plano do ux-ui, com as recomendações "A" escolhidas.

### Layout

- `.hora-painel` recebe `container-type: inline-size`.
  - Com `@container (min-width: 520px)`, `li.evento` e `.bloco-linha` viram grade `1fr auto`, com as ações à direita do cartão.
  - Abaixo de 520 px, as ações vão para uma linha `.acoes-item` logo abaixo do cartão, alinhada à direita, com `flex-wrap` e gap `--esp-2`.
  - Assim, as ações ficam abaixo do cartão a 390, 1280 (coluna de 294 px) e 1920, e na mesma linha a 768.
- Os botões são irmãos do `button.cartao-evento` dentro do `li.evento`, nunca dentro dele.
- Cartão de evento:
  - Mostra "Guardar" e "Apagar" (`.botao` e `.botao-perigo`).
  - Clipe sem `ev.clipe`: só "Apagar".
- Bloco de trechos: `<div class="bloco-linha">` com o `.bloco` mais "Guardar". O bloco não tem Apagar.
- A hora termina num rodapé `.hora-rodape` com "Apagar esta hora" (`botao-perigo`). Fica a 100% da largura abaixo de 520 px e alinhado à direita acima disso. Só aparece se a hora tem eventos ou trechos apagáveis.
- No topo da seção do dia vai a alternância `[ Linha do tempo | Guardados (n) ]`: dois `.botao` com `aria-pressed`. Guardados troca a régua, a pílula e a lista pela `ul.guardados`.

### Confirmação (padrão `.confirma`)

- Abre no lugar da linha de ações (ou do rodapé) e esconde o botão que a abriu. Só uma fica aberta por vez.
- `role="group"` com `aria-label="Confirmar apagar"`. Os botões são "Sim, apagar" (`botao-perigo`) e "Cancelar".
- Textos:
  - Item: "Apagar o clipe de Movimento das 16:04? Não dá para desfazer."
  - Hora: "Apagar os 7 clipes e 12 min de gravação das 16h? Não dá para desfazer."
    - Sem trechos ou com `apagarHoraTrechos: false`, sai a parte "e 12 min de gravação".
    - Com 1 clipe, no singular: "o clipe".
    - Sem clipes: "Apagar 12 min de gravação das 16h?".
  - Pasta: "Apagar a pasta 2026-11-17-rocky com 14 trechos? Não dá para desfazer."
  - Hora com algo guardado: acrescenta "O que está em Guardados continua."
- Foco: ao abrir, vai para Cancelar. Esc e Cancelar fecham e devolvem o foco ao botão que abriu.
- Enquanto há confirmação aberta ou pedido em andamento, `render()` fica suspenso (timer e SSE). Ao fechar, roda um `render` pendente.
- A página manda os `ids` que contou.

### Estados

- Apagando:
  - "Sim, apagar" ganha `.ocupado`, mostra o `.gira` e o texto "Apagando…".
  - Os dois botões ficam `disabled` e o `li.hora` recebe `aria-busy="true"`.
- Feito:
  - Recarrega o dia e anuncia em `#anuncio`: "Clipe das 16:04 apagado." ou "7 clipes das 16h apagados."
  - Depois de apagar um item, o foco vai ao próximo cartão; sem próximo, ao `.hora-cab`.
  - Depois de apagar a hora, o foco vai à próxima `.hora-cab`; sem próxima, a `#dia-rotulo`.
- Erro: `p.aviso-erro role="alert"` com "Não consegui apagar. Nada foi apagado." (ou o `erro` do servidor) e um `botao-link` "Tentar de novo".
- Parcial: "Apaguei 5 de 7. 2 não deu para apagar." com Tentar de novo.
- Sem conexão: Guardar, Apagar e Tocar ficam `disabled`.
- Player: se o que vai ser apagado está tocando (alguma url de `player.urls` está no conjunto apagado), chama `voltarAoVivo()` antes do pedido e anuncia "Voltou ao ao vivo."
- Guardar:
  - Durante a cópia: "Guardando…" com `.gira` e `disabled`.
  - Feito: "✓ Guardado" em `--ok`, com `aria-disabled="true"` e ainda focável. Anuncia "Clipe das 16:04 guardado em Guardados."
  - Erro: "Não consegui guardar." (ou o `erro` do servidor) e Tentar de novo.

### Guardados

- `ul.guardados` com um `li.guardado` por pasta, no fundo do `.hora`. Cada item tem:
  - título: o rótulo;
  - nota: "14 trechos · 14 min · com vídeo" ("só som" se todos são `soAudio`; os minutos vêm de `trechoSegundos` × número de arquivos);
  - "▶ Tocar" e "Apagar".
- Tocar: `player.tocar({ urls, soAudio, rotulo, prefixo: 'Guardado' })`. A faixa mostra "Guardado · rótulo · 3 de 14". Com mais de uma url, a faixa sempre mostra "n de N".
- Vazio: "Nada guardado ainda. Use Guardar num clipe ou trecho da linha do tempo."
- Carregando: dois `.esqueleto`. Erro: `mensagem()` com Tentar de novo.

### Acessibilidade

- Todo botão mede ≥ 48×48 px.
- O aria-label começa pelo texto visível, por exemplo: "Guardar clipe de Movimento das 16:04", "Apagar clipe de Som das 16:12", "Guardar trecho 16:00–16:12 com vídeo", "Apagar esta hora, 16h, 7 clipes", "Tocar pasta 2026-11-17-rocky".

### Critérios de aceite

1. Nada de rolagem horizontal a 390, 768, 1280 e 1920 px.
2. Todos os botões novos medem ≥ 48×48 px.
3. A 768 px as ações ficam na linha do cartão; nas outras larguras, abaixo dele.
4. A confirmação diz o número exato de itens e "Não dá para desfazer". O foco vai para Cancelar, e Esc fecha a confirmação.
5. A confirmação sobrevive ao timer e ao SSE.
6. Apagar o que está tocando volta ao ao vivo, sem erro no console.
7. "✓ Guardado" continua depois de recarregar a página.
8. A pasta `2026-11-17-rocky` mostra 14 trechos e toca em sequência, com "n de 14".
9. Com o servidor respondendo 500, aparece o erro e nada some.
10. Guardados tem os estados vazio, carregando e erro.
