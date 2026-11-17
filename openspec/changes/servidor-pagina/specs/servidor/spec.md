## ADDED Requirements

### Requirement: Servidor só local
O servidor HTTP SHALL escutar só em `127.0.0.1`, na porta `servidorPorta`, e SHALL recusar com 421 todo pedido cujo cabeçalho `Host` não seja `127.0.0.1:<porta>`, `localhost:<porta>` ou um item de `hostsPermitidos`.

#### Scenario: Host desconhecido
- **WHEN** chega um pedido com `Host: evil.example`
- **THEN** a resposta é 421 e nenhuma rota roda

### Requirement: Ponto de middleware para o Access
O servidor SHALL aceitar uma lista `antes` de funções async `(req, res) => boolean`, executadas em ordem depois da checagem de host e antes das rotas; `false` encerra o pedido.

#### Scenario: Middleware recusa
- **WHEN** uma função de `antes` responde 403 e devolve `false`
- **THEN** nenhuma rota é executada e o cliente recebe o 403

### Requirement: Arquivos de gravação sem path traversal
O servidor SHALL servir de `gravacoes/` só `trechos/` e `clipes/` (`.mp4`, `.jpg`) em `/arquivos/` e só `aovivo/` (`.m3u8`, `.ts`) em `/aovivo/`, com suporte a `Range`, e SHALL responder 404 a qualquer caminho fora disso, com `..`, `\`, `:`, byte nulo, codificação dupla ou link que saia da pasta.

#### Scenario: Tentativa de traversal
- **WHEN** o pedido é `/arquivos/trechos/..%2f..%2fconfig.local.json` ou `/arquivos/trechos/%2e%2e%5cestado.json`
- **THEN** a resposta é 404

#### Scenario: Range
- **WHEN** o pedido de um trecho traz `Range: bytes=0-99`
- **THEN** a resposta é 206 com 100 bytes e `Content-Range`

### Requirement: Controles só por POST com proteção contra CSRF
`/api/controle` SHALL aceitar só `POST` com `Content-Type: application/json`, cabeçalho `X-Rocky: 1`, `Sec-Fetch-Site` ausente, `same-origin` ou `none` e `Origin` (se houver) igual ao host; `GET` SHALL dar 405 e os demais casos 403.

#### Scenario: GET no controle
- **WHEN** chega `GET /api/controle`
- **THEN** a resposta é 405 e o estado não muda

#### Scenario: Pedido de outro site
- **WHEN** chega um POST com `Origin: https://evil.example` ou sem `X-Rocky`
- **THEN** a resposta é 403 e o estado não muda

#### Scenario: Câmera com a captura parada
- **WHEN** chega `camera-desligar` com o estado `parado`
- **THEN** a resposta é 409 com a mensagem em pt-BR

### Requirement: Linha do tempo do dia
`GET /api/dia/AAAA-MM-DD` SHALL listar os trechos do dia (com `soAudio` e `emAndamento`) e os eventos do `.jsonl` do dia, ignorando linhas e arquivos inválidos, no formato do design.

#### Scenario: Linha inválida no jsonl
- **WHEN** o arquivo de eventos tem uma linha quebrada entre duas válidas
- **THEN** a resposta traz os dois eventos válidos

#### Scenario: Dia inválido
- **WHEN** o pedido é `/api/dia/2026-13-40` ou `/api/dia/..`
- **THEN** a resposta é 400 ou 404, sem ler disco fora de `gravacoes/`

### Requirement: Estado e eventos ao vivo
`GET /api/ao-vivo` SHALL ser um fluxo SSE que envia o estado ao conectar, a cada troca de estado e a cada evento novo, com batida a cada `sseBatidaSegundos`.

#### Scenario: Troca de estado
- **WHEN** o gravador muda para `so-som`
- **THEN** cada cliente SSE recebe `event: estado` com `"estado":"so-som"`

### Requirement: Ouvir no site
`GET /api/ouvir/pcm` SHALL enviar o PCM do distribuidor em fluxo e `GET /api/ouvir/mp3` SHALL enviar MP3 de um único codificador compartilhado, que liga com o primeiro ouvinte e desliga com o último; acima de `ouvirSiteMax` ouvintes a resposta SHALL ser 503.

#### Scenario: Último ouvinte sai
- **WHEN** o único cliente do MP3 fecha a conexão
- **THEN** o processo codificador é encerrado
