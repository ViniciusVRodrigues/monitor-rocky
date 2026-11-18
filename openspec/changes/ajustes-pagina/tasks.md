## 1. Plano
- [x] 1.1 ux-ui: diagnóstico dos avisos de som, zoom 200%, modo gravação e opções para o player em 1280 px (pergunta à pessoa pela coordenadora).

## 2. Página
- [x] 2.1 Um só aviso de ativar som (teste).
- [x] 2.2 `recuperou` zera quando o vídeo volta a tocar (teste).
- [x] 2.3 Ajustes de zoom 200% e modo gravação conforme o plano.
- [x] 2.4 Player em 1280 px conforme a escolha da pessoa.

## 3. Entrega
- [x] 3.1 Prints em 390, 768, 1280 e 1920 px e zoom 200%, conferidos pela sessão; ux-ui em modo validação.

## Notas (2026-11-18)
- Plano do ux-ui: fica o botão grande ("Toque para ouvir o Rocky"); sai o overlay sobre o vídeo (no ARZOPA ele escurecia o vídeo para sempre). O mini do cabeçalho diz "Ativar som".
- `recoverMediaError` do hls.js 1.7.4 refaz o attach com `media.load()`, que pausa o vídeo, e a lib não chama `play()` (ver `recoverMediaError` e `setSource` em `hls.mjs`; https://github.com/video-dev/hls.js/blob/master/docs/API.md). Por isso o player chama `play()` e volta a vigiar a conexão depois de recuperar.
- Player em 1280: a pessoa escolheu a C (linha do tempo recolhível num trilho, escolha em `rocky.linhaTempo`). ARZOPA e VG249 em 1920×1080: recolhida, o vídeo vai de 1408×792 a 1671×940.
