# Design — servidor-pagina (ROCKY-3)

## Contexto

O ROCKY-1 entrega `iniciarMonitor(cfg)` → `{ gravador, distribuidor, ouvinte, parar }`, os trechos em `gravacoes/trechos/AAAA-MM-DD/HH-MM-SS.mp4` (MP4 fragmentado; só áudio em `so-som`) e o HLS em `gravacoes/aovivo/index.m3u8`. O ROCKY-2, em paralelo, grava eventos em `gravacoes/eventos/AAAA-MM-DD.jsonl` e clipes em `gravacoes/clipes/AAAA-MM-DD/HH-MM-SS-<tipo>.mp4` (+ `.jpg`), e expõe `iniciarDeteccao(cfg)` → `{ saidasExtras, ligar({distribuidor}), aoEvento(fn), parar() }`.

## Decisões

### 1. Servidor sem framework
`node:http` puro, roteamento por tabela. Nada de Express nem `ws`: os fluxos ao vivo usam SSE e fetch em fluxo, que o `node:http` já resolve. Dependência nova só o `hls.js` (exato `1.7.4`), servido de `node_modules/hls.js/dist/hls.min.js` em `/vendor/hls.min.js`. Assim o site não chama terceiros e a CSP fica em `'self'`.

### 2. Ouvir com pouco atraso (meta 1–2 s)
Pesquisa (links no fim): no iOS, o Web Audio é suspenso quando a tela apaga ou o Safari vai para segundo plano, e não há API para impedir isso. Um elemento `<audio>` tocando de verdade continua, e a Media Session precisa dele. Um `<audio>` mudo, ou desmutado depois sem gesto, não é confiável no iOS.
- **Modo `pcm`** (padrão no PC): `GET /api/ouvir/pcm` devolve um fluxo HTTP de PCM s16le mono em `ouvirHz`. O cliente lê com `fetch().body.getReader()`, cria um `AudioBuffer` por bloco na taxa `ouvirHz` (o navegador reamostra, o que evita o Safari ignorar a taxa pedida) e agenda com `AudioBufferSourceNode` num `proximoInicio` corrido. A folga é `ouvirFolgaMs` (300 ms). Se `proximoInicio - ctx.currentTime` passa de `ouvirAtrasoMaxMs` (1000 ms), descarta blocos até voltar à folga, para o atraso não crescer. Sem worklet.
- **Modo `mp3`** (padrão no celular, `pointer: coarse`): `<audio src="/api/ouvir/mp3">` iniciado no próprio clique, audível desde o início, com Media Session (título "Rocky · ao vivo"). O servidor mantém um único ffmpeg codificador (PCM → MP3, `libmp3lame`, `ouvirMp3Bitrate`), que liga com o primeiro ouvinte e desliga com o último. Contra a deriva: se `buffered.end − currentTime` passar de `ouvirMp3AtrasoMaxSegundos`, o cliente salta para perto do fim do buffer e, se não der, recarrega o `src`.
- `ouvirModo`: `auto` (por `pointer: coarse`), `pcm` ou `mp3`. O cliente recebe isso em `/api/config`.
- Não verificável aqui: tocar com a tela apagada no iPhone e no Android. Fica registrado e pedimos um teste num aparelho real.
- Limite de ouvintes simultâneos por modo: `ouvirSiteMax` (503 acima disso).

### 3. Trechos tocados direto
O MP4 fragmentado (com `empty_moov`) tocou e avançou no Chrome com duração correta, com e sem vídeo (teste em 2026-11-17, trechos sintéticos de 8 s). Servimos o arquivo como está, com `Range`/`206` (o Safari exige isso para mídia). Sem remux. O trecho mais recente pode ainda estar sendo escrito: ele vem com `emAndamento: true`.

### 4. HLS e troca de estado
Cada troca `gravando` ↔ `so-som` reinicia o ffmpeg e recomeça a numeração do HLS. Por isso, a cada evento SSE `estado`, o cliente destrói o player hls.js e cria outro (ou recarrega o `src` nativo). O vídeo ao vivo fica `muted` e `playsinline`; o som vem do Ouvir.

### 5. Segurança
- **Escuta** fixa em `127.0.0.1`, sem chave para mudar. A porta (`servidorPorta`) é configurável.
- **Host permitido** contra DNS rebinding: `127.0.0.1:<porta>`, `localhost:<porta>` e `hostsPermitidos` (o ROCKY-4 põe `rocky.vvr.dev.br`). Host fora da lista → 421.
- **Middleware `antes`**: `criarServidor({ antes: [fn] })`, onde cada `fn(req, res)` é async e devolve `true` para seguir ou `false` se já respondeu. Roda depois da checagem de host e antes de qualquer rota. O ROCKY-4 pluga ali a validação do `Cf-Access-Jwt-Assertion`.
- **Arquivos**: só `GET`/`HEAD`. Prefixo `/arquivos/` só para `trechos/` e `clipes/`, com extensões `.mp4` e `.jpg`. `/aovivo/` só para `.m3u8` e `.ts`. Nada mais de `gravacoes/` (por exemplo, `estado.json` e `eventos/`) sai por arquivo. A resolução decodifica uma vez, recusa `\`, `\0`, `:`, segmentos `..` ou `.`, e caminhos absolutos. Depois de `path.resolve`, confere o prefixo `raiz + sep` sem diferenciar maiúsculas, e com `realpath`, para não seguir links que saem da pasta. Qualquer violação → 404, sem dizer o motivo.
- **Controles**: só `POST /api/controle`. Exigem `Content-Type: application/json`, o cabeçalho `X-Rocky: 1` (que força o preflight de CORS, que o servidor não atende), `Sec-Fetch-Site` ausente, `same-origin` ou `none`, e, se houver `Origin`, que ela seja `http(s)://<Host>`. Falhou → 403. `GET` → 405.
- **Leituras da API e dos fluxos**: recusam `Sec-Fetch-Site: cross-site` (403).
- **Cabeçalhos** em toda resposta:
  - `Content-Security-Policy: default-src 'self'; img-src 'self' data:; media-src 'self' blob:; worker-src 'self' blob:; connect-src 'self'; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`;
  - `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`;
  - `Cache-Control: no-store` na API, nos fluxos e no `.m3u8`.
- Corpo do POST limitado a 1 KB. Erros respondem JSON sem pilha.

### 6. Eventos ao vivo
SSE em `GET /api/ao-vivo`. Leva as trocas de estado (`gravador.aoMudar`, `ouvinte` ligado/desligado) e os eventos novos (`aoEvento`, se a detecção existir), com um comentário de batida a cada `sseBatidaSegundos`. Além disso, enquanto mostra "hoje", o cliente recarrega o dia a cada `linhaTempoAtualizarSegundos`, o que também cobre trechos novos e a falta da detecção.

### 7. Ponto de entrada
`src/principal.js` (`npm start`):
1. carrega a config;
2. chama `iniciarMonitor(cfg)`. Com o ROCKY-2 no main, ele mesmo liga a detecção, a menos que `cfg.deteccao === false`, e devolve `deteccao`, que é null quando ela não existe. **Não** chamar `iniciarDeteccao` aqui: rodaria duas vezes;
3. passa `aoEvento: monitor.deteccao?.aoEvento?.bind(monitor.deteccao)`, que fica undefined sem detecção, para `criarServidor({ cfg, monitor, aoEvento })` e chama `listen(servidorPorta, '127.0.0.1')`;
4. no Ctrl+C, para o servidor e depois o monitor (que para a detecção).

O `captura.js` continua com o próprio main, para rodar só a captura.

### 8. Nível do som (pedido da pessoa, 2026-11-17)
Uma barrinha perto do chip e do vídeo mostra se o microfone capta algo, sem tocar som.
- **Servidor** (`src/servidor/nivel.js`): função pura que recebe blocos s16le e, a cada janela de `1/nivelHz` s de amostras, calcula o RMS, passa para dBFS e mapeia `[nivelPisoDb, 0]` em `[0, 1]`. A subida é imediata. A descida segue `n = max(novo, anterior × nivelSuavizacao)`. O resultado vai como `event: nivel` no SSE `/api/ao-vivo` (com 3 casas). O servidor só se inscreve no distribuidor enquanto houver pelo menos um cliente SSE.
- **Página**: desenha a barra com `transform: scaleX(n)` (sem transição quando `prefers-reduced-motion`). Em `parado`, ou sem `nivel` há mais de 2 s, mostra "sem som". A barra é `aria-hidden="true"` e leva ao lado um rótulo discreto visível ("Som"). Aparece em `gravando` e `so-som`.

### 9. Som ao vivo ligado ao abrir (pedido da pessoa, 2026-11-17)
O botão grande deixa de ser "Ouvir" e vira um mute: **"Silenciar"** quando o som toca e **"Ativar som"** quando está silenciado. Como o rótulo muda, o botão não usa `aria-pressed`. Os textos de transição continuam: "Conectando…", "Sem som. Reconectando…" e "Não deu para ouvir. Tentar de novo".
- **Ao abrir**: o padrão vem de `somAoAbrir`. Se o `localStorage` tiver `rocky.som` (`"ligado"` ou `"silenciado"`), vale ele. Toda leitura e escrita vai em try/catch: sem storage, vale a config.
- Se for para tocar, a página tenta logo ao carregar. No PCM, cria o `AudioContext` e chama `resume()`; se o `state` continuar `suspended`, está bloqueado. No MP3, `audio.play()` rejeita com `NotAllowedError`. Bloqueado → mostra em destaque, sobre a área do vídeo, o botão **"Toque para ouvir o Rocky"**. O primeiro `pointerdown` ou `keydown` em qualquer lugar da página (ou o botão) inicia o som, e o aviso some. A escolha salva não muda por causa do bloqueio.
- **Silenciar** fecha o fluxo de áudio (não gasta rede) e salva `"silenciado"`. **Ativar som** abre de novo e salva `"ligado"`.
- **Política dos navegadores**: o Chrome libera som sem gesto se a pessoa já interagiu com o site, e no desktop também pelo Media Engagement Index (uso frequente de mídia com som no site). Então, no PC usado sempre, a página tende a abrir tocando. Desde o Chrome 71 o `AudioContext` criado sem gesto nasce `suspended`. O Safari no iOS exige gesto a cada carga de página e não guarda isso. A página não tem como "lembrar" a liberação: só a escolha de som ligado ou silenciado.
  - https://developer.chrome.com/blog/autoplay
  - https://www.chromium.org/audio-video/autoplay
  - https://webkit.org/blog/6784/new-video-policies-for-ios/
- O "Ouvir no PC" (caixas do PC) continua desligado ao iniciar, para não dar eco com a página aberta no mesmo PC.

## Contrato da API (fixo; o cliente e o servidor seguem este texto)

Toda resposta JSON é `application/json; charset=utf-8`. Os horários dos trechos são locais (`HH:MM:SS`). O dia é `AAAA-MM-DD`, validado por regex e data real.

### `GET /api/config` → 200
```json
{ "ouvirModo": "auto", "ouvirHz": 16000, "ouvirFolgaMs": 300, "ouvirAtrasoMaxMs": 1000,
  "ouvirMp3AtrasoMaxSegundos": 4, "linhaTempoAtualizarSegundos": 30,
  "bufferHoras": 4, "trechoSegundos": 60, "aovivoSegundos": 2, "aovivoSegmentos": 6,
  "controleTempoLimiteSegundos": 20, "somAoAbrir": true, "nivelHz": 10 }
```

### `GET /api/estado` → 200
```json
{ "estado": "gravando", "ouvindoPC": false, "agora": "2026-11-17T14:03:05-03:00" }
```
`estado` ∈ `gravando | so-som | parado`.

### `POST /api/controle`
Corpo: `{ "acao": "gravar" | "parar" | "camera-desligar" | "camera-ligar" | "ouvir-pc-ligar" | "ouvir-pc-desligar" }`
- 200: `{ "ok": true, "estado": "so-som", "ouvindoPC": false }`
- 400: `{ "ok": false, "erro": "Ação desconhecida." }` (ação ou JSON inválido)
- 403: `{ "ok": false, "erro": "Pedido recusado." }` (CSRF)
- 409: `{ "ok": false, "erro": "A captura está parada; use Voltar a gravar primeiro." }` (camera-* em `parado`)
- 504: `{ "ok": false, "erro": "O monitor não respondeu a tempo." }` (passou de `controleTempoLimiteSegundos`)
- 500: `{ "ok": false, "erro": "<mensagem em pt-BR>" }`

### `GET /api/dias` → 200
```json
{ "dias": ["2026-11-17", "2026-11-16"], "hoje": "2026-11-17" }
```
São os dias com pasta em `trechos/` ou `clipes/`, ou com arquivo em `eventos/`, mais hoje (que sempre entra), sem dias futuros, em ordem decrescente.

### `GET /api/dia/AAAA-MM-DD` → 200 (400 se o dia for inválido)
```json
{ "dia": "2026-11-17", "hoje": true,
  "trechos": [
    { "inicio": "14:02:00", "url": "/arquivos/trechos/2026-11-17/14-02-00.mp4",
      "soAudio": false, "emAndamento": false, "bytes": 5242880 }
  ],
  "eventos": [
    { "id": "…", "inicio": "2026-11-17T14:03:05-03:00", "fim": "2026-11-17T14:03:12-03:00",
      "tipo": "movimento", "intensidade": 0.62,
      "clipe": "/arquivos/clipes/2026-11-17/14-02-55-movimento.mp4",
      "miniatura": "/arquivos/clipes/2026-11-17/14-02-55-movimento.jpg" }
  ] }
```
- `trechos`: ordem crescente. Ficam de fora arquivos com menos de 1 KB ou nome fora do padrão `HH-MM-SS.mp4`.
- `soAudio`: o servidor lê os primeiros 64 KB e procura um `hdlr` do tipo `vide`; o resultado fica em cache por caminho, tamanho e mtime.
- `emAndamento`: o trecho mais recente de hoje com mtime há menos de `trechoSegundos + 10` s.
- `eventos`: ordem crescente de `inicio`. Linhas inválidas do `.jsonl` são ignoradas. `clipe` e `miniatura` saem como URL `/arquivos/…` só se passarem pela mesma validação de caminho dos arquivos; senão saem `null`. `tipo` fora de `movimento | som` ou `intensidade` não numérica descartam a linha. A intensidade é limitada a 0..1.

### `GET /api/ao-vivo` → `text/event-stream`
```
event: estado
data: {"estado":"so-som","ouvindoPC":false}

event: evento
data: { mesmo formato de um item de "eventos" acima }

: batida

event: nivel
data: {"nivel":0.23}
```
O primeiro `estado` sai logo ao conectar. O `nivel` vem cerca de `nivelHz` vezes por segundo, enquanto chega PCM (veja §8). Não vem quando não há PCM, como em `parado`.

### `GET /api/ouvir/pcm` → 200 `application/octet-stream`
O corpo é PCM s16le mono em `ouvirHz`, em fluxo, até o cliente fechar. Cabeçalhos `X-Taxa: <ouvirHz>` e `Cache-Control: no-store, no-transform`. Acima de `ouvirSiteMax` → 503.

### `GET /api/ouvir/mp3` → 200 `audio/mpeg`
MP3 em fluxo, compartilhado por todos os ouvintes. Acima de `ouvirSiteMax` → 503. Sem codificador disponível → 503.

### Arquivos
- `GET /` → `web/index.html`; `GET /<arquivo>` → `web/<arquivo>` (só `.html .css .js .svg .png .ico .webmanifest`, sem subpastas além de `web/js/` e `web/img/`).
- `GET /vendor/hls.min.js`.
- `GET /aovivo/index.m3u8`, `GET /aovivo/segNNNNN.ts`.
- `GET /arquivos/trechos/AAAA-MM-DD/HH-MM-SS.mp4`, `GET /arquivos/clipes/AAAA-MM-DD/<nome>.mp4|.jpg`, com `Range` (206 e 416).

## Chaves novas no `config.json`

| Chave | Padrão | Para quê |
| --- | --- | --- |
| `servidorPorta` | 8321 | porta do servidor (sempre em 127.0.0.1) |
| `hostsPermitidos` | `[]` | hosts extras aceitos no cabeçalho Host (ex.: o domínio do túnel) |
| `ouvirModo` | `auto` | `auto`, `pcm` ou `mp3` |
| `ouvirSiteMax` | 4 | ouvintes simultâneos do site, por modo |
| `ouvirMp3Bitrate` | `32k` | bitrate do MP3 ao vivo |
| `ouvirFolgaMs` | 300 | folga do tocador PCM |
| `ouvirAtrasoMaxMs` | 1000 | atraso máximo do PCM antes de descartar |
| `ouvirMp3AtrasoMaxSegundos` | 4 | atraso máximo do MP3 antes de saltar ou recarregar |
| `sseBatidaSegundos` | 15 | batida do SSE |
| `linhaTempoAtualizarSegundos` | 30 | recarga do dia de hoje |
| `controleTempoLimiteSegundos` | 20 | tempo máximo de um controle |
| `nivelHz` | 10 | quantas vezes por segundo o nível do som vai para a página |
| `nivelSuavizacao` | 0.6 | queda suave da barra (0 = sem suavizar, perto de 1 = bem lenta); a subida é imediata |
| `nivelPisoDb` | -60 | dBFS que vira barra vazia (0 dBFS é barra cheia) |
| `somAoAbrir` | true | a página abre com o som ao vivo ligado (a escolha salva no aparelho vale mais) |

## Riscos

| Risco | Como evitamos | Teste |
| --- | --- | --- |
| Path traversal no Windows | decodificar uma vez; recusar `\`, `\0`, `:`, `..`; conferir prefixo sem caixa; `realpath` | `..%2f`, `%2e%2e`, `%5c`, `C:\`, `%00`, `TRECHOS/..`, `estado.json`, `eventos/x.jsonl` dão 404 |
| CSRF nos controles | POST com JSON, `X-Rocky`, `Sec-Fetch-Site`, `Origin` | GET dá 405; sem cabeçalho, 403; Origin de outro site, 403; form-urlencoded, 403 |
| DNS rebinding | lista de hosts | `Host: evil.com` dá 421 |
| Ouvinte lento enche a memória | `ligarEscrita` descarta blocos; limite de ouvintes | teste do limite (503) |
| ffmpeg do MP3 órfão | liga com o primeiro ouvinte, desliga com o último e no `fechar()` | teste com spawn falso |
| Pedir controle no `parado` | 409 com texto | teste |
| Atraso do ouvir crescer | descarte no PCM; salto ou recarga no MP3 | teste da lógica de agendamento (função pura) |
| Tela apagada no iPhone | `<audio>` real + Media Session | só no aparelho: fica pendente para a pessoa |

## Pesquisa que decidiu
- Web Audio suspenso no iOS com a tela bloqueada; `<audio>` real + Media Session como saída: https://adactio.com/journal/19929, https://developer.apple.com/forums/thread/762582, https://github.com/cboin1996/songbirdweb/issues/16
- Áudio ao vivo com pouco atraso, com fluxo próprio e fallback: https://github.com/as-you-like/3las
- Atraso típico de MP3 em fluxo HTTP (1–5 s, conforme o buffer do cliente): https://www.shoutcastnet.com/blogs/how-to-reduce-live-stream-latency-wowza.php
