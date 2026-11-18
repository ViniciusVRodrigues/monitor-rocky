# Ajustes da página (ROCKY-13)

Issue: https://github.com/ViniciusVRodrigues/monitor-rocky/issues/21

## Por quê
A página mostra dois avisos para a mesma coisa ("Toque para ouvir" e "Ativar som"). O `recuperou` do hls.js não zera, então depois da primeira recuperação o player não se recupera mais. Faltou validar zoom 200% e o modo gravação, e a posição do player em 1280 px ficou em aberto.

## O que muda
- Um só aviso para ativar o som.
- O `recuperou` volta a zero quando o vídeo volta a tocar.
- Página validada em zoom 200% e no modo gravação (linha do tempo), em 390, 768, 1280 e 1920 px.
- Posição do player em 1280 px: o ux-ui propõe e a escolha vai à pessoa, pela coordenadora.

## Impacto
Spec `pagina`. Áreas: só `web/` (`index.html`, `estilo.css`, `js/`) e `test/web-*.test.js`.
