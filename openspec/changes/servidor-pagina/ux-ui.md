# Plano de tela (ux-ui, 2026-11-17)

Decisões de gosto: seguimos as recomendações (A) enquanto a pessoa não responde.

## MOCKS
Não fiz. A tela ainda não existe, então não há captura para servir de referência, e cada imagem gasta o limite do Codex da pessoa. Recomendo um mock a 390 px depois do primeiro HTML, usando o próprio print como referência.

## DIAGNÓSTICO
Não há tela hoje. O que o plano precisa resolver:
- A pessoa olha de longe e, às vezes, em reunião. O estado (gravando, só som ou parado) tem que se ler em menos de 2 s.
- Liberar a câmera tem que levar um toque.
- Parar sem querer custa gravação perdida.
- A linha do tempo cobre 24 h, mas só há trechos das últimas 4 h. No celular, um minuto da régua mede cerca de 0,25 px, então tocar em minutos na régua não funciona.

## SISTEMA MÍNIMO
- Ficam em `web/estilo.css`, como variáveis em `:root`, com `@media (prefers-color-scheme: dark)`.
- Cores, no formato claro / escuro:
  - `--fundo` #F6F6F4 / #121315
  - `--superficie` #FFFFFF / #1C1D20
  - `--texto` #1B1C1E / #ECECEE
  - `--texto-2` #565B62 / #A9ADB4
  - `--borda` #D5D7DB / #33363B (só decorativa)
  - `--borda-controle` #858A92 / #80858D (3:1)
  - `--acento` #1F5FBF / #8AB4FF (botão principal e foco)
  - `--gravando` #C62828 / #FF7A7A
  - `--so-som` #8A5A00 / #F0B44C
  - `--ok` #1E7A3E / #6FD08F
  - `--erro` #B3261E / #FF8A80
- A área do vídeo é sempre `#000`, com texto `#fff`.
- O cinza da régua tem dois tons: `--faixa-video` (cheio) e `--faixa-audio` (listrado, com `repeating-linear-gradient`). A diferença não depende só da cor.
- Tipografia: `system-ui`. Corpo 16 px, secundário 14 px (nunca menos), título 20 px, e horas com `font-variant-numeric: tabular-nums`.
- Espaço em escala de 4: 4, 8, 12, 16, 24, 32. Raio de 8 nos botões e 12 nos cartões. Alvos de no mínimo 48 px de altura.
- Foco: `outline: 3px solid var(--acento); outline-offset: 2px`.

## PLANO

### Hierarquia (as duas larguras)
1. O estado: um chip de status mais a conexão.
2. O ao vivo.
3. Os controles.
4. A linha do tempo.

Há um player só. Tocar uma gravação usa a mesma área do ao vivo, com a faixa "Gravação de 14:23 · Voltar ao ao vivo".

### Celular (360–767 px; acima da dobra a 390 × ~700 úteis)
```
┌ Rocky        [● Gravando]  ┐ 48, fixo (sticky): chip + botão Ouvir compacto ao rolar
│┌──────────────────────────┐│
││   vídeo 16:9 (358×201)   ││
││ AO VIVO · ~8 s atrás     ││
│└──────────────────────────┘│
│[      🔊 Ouvir           ]│ 56, largura toda (principal)
│[Liberar câmera][Ouvir no PC][Parar]│ 48 cada, 3 colunas
│ ‹ Ontem   Hoje, 17/11   › │ 48
│ ▕▒▒  ██▓▓█  ▒▓█▏ régua 24 h│ 40, só visão geral
│ 00   06   12   18   24     │
└────────── lista de horas ──┘
```
Soma até a régua: cerca de 500 px. A lista de horas começa acima da dobra.

### Tablet (768–1023 px)
Uma coluna, como no celular, com o vídeo em até 720 px e centralizado. Os 4 controles ficam numa linha só.

### Computador (≥1024; alvo 1280)
```
┌ Rocky  [● Gravando]                         Conectado ┐
│┌────────────────────────────┐ ┌ ‹ Ontem Hoje › ─────┐│
││  vídeo 16:9 (~800×450)     │ │ régua 24 h          ││
││                            │ │ 14h ▕██▓▓▏ 3 eventos ││
│└────────────────────────────┘ │  └ cartões ...      ││
│[Ouvir][Liberar câmera][Ouvir no PC][Parar] │ (rola dentro)││
└────────────────────────────────────────────┴──────────┘
```
- Grade `minmax(0,2fr) minmax(320px,1fr)`, com `gap` de 24 e `max-width` de 1440 centralizado.
- A coluna da direita tem `height: calc(100dvh - header)` e rolagem própria.
- O vídeo e os controles ficam sempre visíveis no segundo monitor, sem rolar a página.

### Área do vídeo por estado
| Estado | O que aparece |
|---|---|
| `gravando` | O HLS. Selo "AO VIVO · cerca de 8 s atrás". |
| `so-som` | Fundo preto com ícone de microfone e medidor de nível animado (parado se `reduced-motion`). Texto: "Câmera liberada para você usar. O som continua gravando." Botão: "Religar câmera". |
| `parado` | "Nada está gravando. Câmera e microfone livres." Botão principal: "Voltar a gravar". |
| Carregando | "Conectando ao ao vivo…" |
| Erro do HLS | "Não consegui abrir o ao vivo. Tentando de novo…" e o botão "Tentar agora". |
| Gravação tocando | Faixa no topo: "Gravação · 14:23 · só som" (quando for o caso) e o botão "Voltar ao ao vivo". |

### Chip de estado
Leva sempre ícone e texto, nunca só cor:
- "● Gravando" (vermelho)
- "Só som · câmera livre" (âmbar)
- "Parado" (cinza)
- "Reiniciando a captura…", quando o ffmpeg cai

### Botão Ouvir
É um `button` com `aria-pressed`. Usa um `<audio>` próprio, separado do vídeo, mais a Media Session (título "Rocky · ao vivo"), para seguir tocando com a tela apagada.
| Estado | Texto |
|---|---|
| Desligado | "Ouvir" |
| Conectando | "Conectando…" (spinner) |
| Tocando | "Ouvindo · parar" (ícone de onda) |
| Erro | "Sem som. Reconectando…" e, depois de 3 falhas, "Não deu para ouvir. Tentar de novo" |

### Controles
| Controle | Rótulo agora | Efeito |
|---|---|---|
| Câmera | "Liberar câmera" / "Religar câmera" | vai para `so-som` / `gravando` |
| Ouvir no PC | "Ouvir no PC", com `aria-pressed` e o rótulo de estado "tocando no PC" | liga / desliga |
| Gravação | "Parar" / "Voltar a gravar" | `parado` / `gravando` |

Ao aplicar:
- O botão mostra spinner e "Aplicando…", recebe `aria-busy`, e os outros controles da captura ficam desativados.
- O chip só muda quando o servidor confirma.
- Passados 10 s, aparece um aviso inline: "Não deu certo: {motivo}. Tentar de novo".

Parar usa confirmação inline (ver a decisão da pessoa):
- O botão vira, no lugar, "Parar a gravação? [Sim, parar] [Cancelar]". Desfaz sozinho em 6 s.
- Esc cancela, e o foco vai para "Cancelar".

### Linha do tempo: régua mais lista de horas
- **Régua de 24 h.** Visão geral: faixas de cobertura (vídeo cheio; só áudio listrado) e traços de evento, mais altos quando a intensidade é maior. No computador, clicar numa hora rola a lista até ela. No celular a régua é só visual (`aria-hidden`), porque a navegação é a lista.
- **Lista de horas**, da mais recente para a mais antiga. Só aparecem as horas com trechos ou eventos.
  - As horas vazias seguidas viram uma linha só: "00h–09h · sem gravação".
  - Cada hora é um `button` com `aria-expanded`, de 56 px: "14h", uma mini-régua de 60 min e "3 eventos".
- **Ao abrir uma hora:**
  - **Blocos contínuos de trechos**: "14:02–14:37 · com vídeo ▶" e "14:38–14:59 · só som ▶". Cada bloco é um alvo de 48 px, toca do início e emenda os trechos seguintes.
  - **Cartões de evento**: miniatura de 96×54, "14:23 · Movimento" ou "Som (latido?)" sem adivinhar (só "Som"), e a intensidade "forte", "média" ou "fraca" com 3 barrinhas e texto. Tocar no cartão toca o clipe.
- **Navegação entre dias**: "‹ Dia anterior", "Hoje, 17/11" (botão "Ir para hoje" quando não está em hoje) e "Próximo dia ›", desativado em hoje.
- **Evento novo, com a lista rolada**: aparece no topo da lista a pílula "2 eventos novos · ver", com `aria-live="polite"`, e a lista não rola sozinha. Na hora aberta, o cartão entra no topo com um realce que some em 2 s (sem animação com `reduced-motion`).
- **Estados da lista:**
  - Carregando: 3 linhas esqueleto.
  - Dia vazio: "Nada gravado neste dia. Os trechos ficam guardados por 4 horas."
  - Hora fora do buffer, com eventos: "Trechos já apagados (guardamos 4 h). Os clipes dos eventos continuam."
  - Erro: "Não consegui carregar a linha do tempo. Tentar de novo".

### Sem conexão com o servidor
- Faixa no topo, com `role="status"`: "Sem conexão com o monitor no PC. Tentando de novo…"
- Os controles ficam desativados, com o texto "indisponível sem conexão".
- O chip mostra "Estado desconhecido".
- Quando a conexão volta, a faixa some e aparece "Conectado de novo" por 3 s.

## ACESSIBILIDADE
1. Ordem do DOM igual à visual: cabeçalho, player, controles, dia, lista. Regiões `header`, `main` e `section` com `aria-labelledby` ("Ao vivo", "Controles", "Linha do tempo").
2. Uma região `aria-live="polite"` única para o estado da captura, o Ouvir e os "Aplicando…" e "Aplicado". Erro de controle vai em `role="alert"`.
3. Botões de alternar com `aria-pressed`. Horas com `aria-expanded` e `aria-controls`. Lista de eventos em `ul`, e cada cartão é um `button` com nome completo ("Movimento às 14:23, intensidade forte, tocar clipe").
4. Miniatura com `alt=""`, porque o texto do cartão já descreve.
5. Contraste: texto 4,5:1 e borda de controle e foco 3:1, nos dois temas. O âmbar `--so-som` no claro é usado como texto, por isso escuro (#8A5A00).
6. Alvos de no mínimo 48 × 48 px. A régua no celular não é interativa.
7. `prefers-reduced-motion`: sem spinner girando (troca por "…"), sem medidor animado, sem realce que pisca.
8. Zoom de 200% (equivale a 640 px CSS a 1280) cai no layout de uma coluna, sem rolagem horizontal.
9. Vídeo com `muted` e `playsinline`, sem controles nativos de áudio que briguem com o Ouvir.

## CRITÉRIOS DE ACEITE
1. A 390 px, nos dois temas, aparecem sem rolar: o chip de estado, o vídeo, Ouvir, Liberar câmera, Ouvir no PC, Parar, o seletor de dia e a régua (o `bottom` da régua fica abaixo de 720 px).
2. A 1280 px, o vídeo e os 4 controles cabem em 800 px de altura, e a linha do tempo rola só dentro da coluna da direita. O vídeo tem largura de 700 px ou mais.
3. Não há rolagem horizontal (`scrollWidth <= innerWidth`) em 360, 390, 768, 1280 e com 200% de zoom.
4. Todo controle tem 48 px ou mais de altura e de largura (`getBoundingClientRect`).
5. Cada estado (`gravando`, `so-som`, `parado`, reiniciando, sem conexão) tem a tela própria descrita no plano e o chip com texto. Um print de cada, a 390.
6. Clicar num controle mostra "Aplicando…" em até 100 ms, desativa os outros controles da captura e só muda o chip depois da confirmação. Um timeout simulado mostra o erro com "Tentar de novo".
7. Parar pede confirmação inline. Cancelar, Esc ou a espera de 6 s voltam ao botão sem mandar o comando.
8. O Ouvir passa por desligado, conectando, tocando e erro com os textos do plano, e `aria-pressed` acompanha.
9. Tudo funciona só com teclado (Tab, Shift+Tab, Enter, Espaço e Esc), com foco visível em todo elemento e nenhum elemento escondido recebendo foco.
10. Os contrastes calculados batem 4,5:1 (texto) e 3:1 (bordas, foco, faixas da régua contra o fundo) nos dois temas.
11. A linha do tempo mostra os estados vazio, carregando, erro e "trechos já apagados".
12. Um trecho só de áudio toca como áudio, e a área do player diz "só som".
13. Um evento novo injetado com a lista rolada mostra a pílula "eventos novos" e é anunciado, sem mover a rolagem.
14. Com `prefers-reduced-motion: reduce`, nenhuma animação passa de 0 s, exceto o vídeo.
15. Os blocos contínuos emendam os trechos sem tocar no Ouvir. Ouvir e gravação tocam juntos sem se cortar.
16. Todos os textos estão em pt-BR. Nenhuma cor sozinha carrega significado (verificado em escala de cinza).

## DECISÕES DA PESSOA
1. **Como evitar Parar sem querer.**
- A) Confirmação inline "Parar a gravação? Sim / Cancelar". **Recomendo esta.** Não perde nada e é clara em reunião.
- B) Para na hora e mostra "Desfazer" por 8 s. Mais rápido, mas fica uma lacuna de alguns segundos na gravação.
- C) Segurar 1 s. É ruim para teclado e para leitor de tela.
2. **O principal no celular.**
- A) Ouvir em destaque, na largura toda. **Recomendo**, porque de longe a pessoa mais escuta do que vê.
- B) Os 4 botões iguais, em grade 2×2.
3. **Atalhos de teclado no PC** (C para câmera, O para ouvir).
- A) Não ter. **Recomendo** começar sem: o foco pode estar em outro app na reunião.
- B) Ter, com a legenda visível.


## Ajustes depois do plano (2026-11-17, pedidos da pessoa)
- As três decisões de gosto foram aprovadas: as recomendações (A).
- **Som ao vivo ligado ao abrir** (design §9). O botão grande do Ouvir vira o mute: "Silenciar" quando toca, "Ativar som" quando está silenciado. Mantém o mesmo destaque: largura toda no celular, 56 px. Os ícones são alto-falante e alto-falante cortado, sempre com o texto, sem `aria-pressed`.
  - Quando o navegador bloqueia: um botão grande "Toque para ouvir o Rocky" sobre a área do vídeo, com fundo escurecido e alvo ≥ 48 px. Qualquer toque ou tecla na página libera.
- **Barra de nível** (design §8): uma barra fina, de 6 px de altura e cerca de 120 px de largura, na linha do chip de estado, com o rótulo "Som" ao lado.
  - Cor `--ok` no preenchimento, sobre `--borda`.
  - A barra é `aria-hidden`. Em `parado` e sem dados mostra o texto "sem som" no lugar.
  - Sem animação com `prefers-reduced-motion`; mesmo assim, o valor atualiza.
- Critérios novos:
  - (17) Com o som ligado e bloqueado, aparece "Toque para ouvir o Rocky" e um toque em qualquer lugar inicia o som.
  - (18) "Silenciar" sobrevive à recarga da página.
  - (19) A barra de nível se mexe em `gravando` e `so-som` e mostra "sem som" em `parado`, sem quebrar a altura de 720 px a 390 px.
