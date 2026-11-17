# Plano do layout (ux-ui, 2026-11-17)

HTML não muda (a ordem do DOM topo, player, controles, dia já é a de leitura e foco). Tudo em `web/estilo.css`.

## Diagnóstico (hoje)
| Viewport | Player | Problema |
|---|---|---|
| 390x844 | 358x201 | gutter de 16 px; barra de som some com `data-estado="sem-som"` |
| 768x1024 | 720x405 | `.player { max-width:720px }` |
| 1280x800 | 805x453 | `.controles` com 263 px de altura (linha `1fr`) |
| 1920x1080 | 912x513 | `.pagina { max-width:1440px }`; vídeo usa 47% da altura |

Trilho da barra (`--borda` sobre `--fundo`) tem ~1,3:1 (claro) e 1,6:1 (escuro), abaixo de 3:1.

## CSS por seletor
**Base**
- `.pagina`: sem `max-width` (ou `none`).
- `.player`: sem `max-width:720px; margin:0 auto`; fica `width:100%; aspect-ratio:16/9`.
- `.nivel { flex:1 1 auto; }`; `.nivel-barra { flex:1 1 auto; min-width:120px; height:12px; border-radius:6px; background:var(--borda); box-shadow: inset 0 0 0 1px var(--borda-controle); }`; `.nivel-preench { border-radius:6px; }`.
- Sem som: trilho visível e vazio (`opacity:.6`) no lugar de `display:none`; rótulo "Som" sempre visível; "Sem som" segue em texto.

**`@media (max-width:599.98px)`**: `.ao-vivo { margin-inline: calc(-1*var(--esp-4)); }`, `.player { border-radius:0; }`.

**`@media (min-width:600px) and (max-width:1023.98px)`**: `.controles { grid-template-columns: minmax(0,1.3fr) repeat(3,minmax(0,1fr)); }`, `.grade-controles { display:contents; }`, `.confirma, .aviso-offline, .aviso-erro { grid-column:1/-1; }`.

**`@media (min-width:1024px)`** (substitui o bloco atual de `.pagina`/`.ao-vivo`)
- `.pagina { max-width:none; grid-template-columns: minmax(0,1fr) clamp(320px,24vw,440px); grid-template-rows: minmax(0,1fr) auto; align-content:stretch; padding: var(--esp-3) var(--esp-5); }`
- `.ao-vivo { grid-column:1; grid-row:1; min-height:0; container-type:size; display:grid; place-items:center; }`
- `.player { width: min(100cqw, calc(100cqh * 16 / 9)); height:auto; }`
- `.controles { grid-row:2; }`; `.dia { grid-row:1 / span 2; }` (com `overflow-y:auto`).
- `.nivel { max-width:520px; }` (barra larga no topo).

**`@media (min-width:1024px) and (max-height:559.98px)`**: `body { height:auto; overflow:visible; display:block; }`, `.ao-vivo { container-type:normal; }`, `.player { width:100%; }`.

**Opcional, celular deitado `@media (max-width:1023.98px) and (orientation:landscape) and (max-height:500px)`**: `.player { width:min(100%, calc((100dvh - 60px) * 16/9)); margin-inline:auto; }`.

## Acessibilidade
- Foco 3 px em `--acento`; em 390 com player de borda a borda, conferir que o outline de `toque-ouvir` e `btn-voltar-vivo` não é cortado pelo `overflow:hidden` do `.player` (senão `outline-offset:-4px`).
- Alvos de toque ≥ 48 px. Barra com `aria-hidden`; sem `aria-live` no nível.

## Critérios de aceite (tema claro e escuro, gravando)
1. 390x844: `.player` 390 x 219±1 em x=0; `scrollWidth`=390; `.nivel-barra` ≥ 200x12 visível mesmo "Sem som".
2. 768x1024: `.player` ≥ 736 de largura, altura = largura×0,5625 ±1; 4 botões com o mesmo `y`; `scrollWidth`=768.
3. 1280x800: `.player` ≥ 880 de largura, proporção 1,777±0,01; `scrollHeight`=800; base de `.controles` ≤ 788 e altura ≤ 60; `.dia` rola por dentro.
4. 1920x1080: `.player` ≥ 1400x787; nada passa de 1920x1080; `.dia` ≥ 400 de largura; controles inteiros.
5. 1920x1040: igual ao 4, player inteiro visível.
6. 1024x540: rola na vertical, nenhum controle cortado.
7. Barra de som nas 4 larguras com e sem som; trilho ≥ 3:1 contra `--fundo` nos dois temas.
8. Tab: topo, player, controles, dia, com outline inteiro em 390.

## Decisões da pessoa (pendentes)
1. Vídeo fixo no celular ao rolar a linha do tempo (recomendado: sim, só em pé com altura ≥ 700: `.ao-vivo { position:sticky; top:<altura do topo>; z-index:10; }`).
2. Barra de som no topo, larga (recomendado) ou sobre a base do vídeo.

Capturas de hoje: script `cap.cjs` no scratchpad da sessão do cartão (Playwright do andromeda-ui).
