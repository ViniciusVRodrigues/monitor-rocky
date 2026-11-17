Issue: https://github.com/ViniciusVRodrigues/monitor-rocky/issues/5

## Why

A captura (ROCKY-1) grava e gera o ao vivo, mas só há comandos de terminal. A pessoa quer ver e ouvir o Rocky pelo celular e por um segundo monitor, controlar a câmera com um toque durante reuniões e rever o dia (trechos e eventos).

## What Changes

- Servidor HTTP local (Node, sem framework) que escuta só em `127.0.0.1`, porta configurável. Ele vira o processo principal do `npm start`: sobe o monitor (e a detecção do ROCKY-2, se existir) e o servidor.
- Página única em pt-BR (`web/`, JS puro, sem build), responsiva (390 e 1280 px) e acessível:
  - ao vivo pelo HLS (hls.js servido localmente; HLS nativo no Safari);
  - "Ouvir" com pouco atraso: PCM por fetch em fluxo + Web Audio no PC; `<audio>` com MP3 em fluxo + Media Session no celular (segue com a tela apagada);
  - controles gravar/parar, câmera (só som) e ouvir no PC, com o estado sempre visível e atualizado por SSE;
  - linha do tempo do dia (trechos e eventos), com navegação entre dias e reprodução.
- Segurança: lista de hosts permitidos (contra DNS rebinding), arquivos de `gravacoes/` servidos só de pastas e extensões permitidas e sem path traversal, controles só por POST com proteção contra CSRF, cabeçalhos (CSP, nosniff), e um ponto de middleware para o ROCKY-4 validar o JWT do Cloudflare Access.
- Chaves novas no `config.json`, documentadas no README.

## Capabilities

### New Capabilities
- `servidor`: servidor HTTP local, rotas de API, arquivos, áudio ao vivo, eventos ao vivo e segurança.
- `pagina`: a página web (ao vivo, ouvir, controles, linha do tempo).

### Modified Capabilities

## Impact

Código novo em `src/servidor/`, `src/principal.js`, `web/` e `test/`. `npm start` passa a ser `node src/principal.js`. Dependência nova: `hls.js` (servida pelo próprio servidor). O ROCKY-4 pluga a validação do Access no middleware `antes`.
