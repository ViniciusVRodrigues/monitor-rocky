# deteccao Specification

## Purpose
Detectar movimento e som (latido, choro) com limiares configuráveis e transformar cada evento em clipe, miniatura e linha de registro, guardados à parte do buffer de gravação contínua (ROCKY-2, issue #4).
## Requirements
### Requirement: Detecção de som
O sistema SHALL detectar som alto (latido, choro) pelo volume do áudio ao vivo, com limiar em dBFS e duração mínima configuráveis, nos estados `gravando` e `so-som`.

#### Scenario: som alto
- **WHEN** o áudio fica acima do limiar por mais que a duração mínima
- **THEN** abre-se um evento `som` com intensidade entre 0 e 1

#### Scenario: silêncio e clique isolado
- **WHEN** o áudio fica abaixo do limiar, ou passa dele por menos que a duração mínima
- **THEN** nenhum evento é criado

### Requirement: Detecção de movimento
O sistema SHALL detectar movimento pela fração de pixels que mudam entre quadros de baixa resolução, com limiar por pixel, área mínima e quadros seguidos configuráveis, só no estado `gravando`.

#### Scenario: movimento
- **WHEN** uma área maior que a mínima muda em quadros seguidos
- **THEN** abre-se um evento `movimento`

#### Scenario: câmera desligada
- **WHEN** o estado é `so-som`
- **THEN** o ffmpeg não abre a saída de movimento e nenhum evento `movimento` é criado

### Requirement: Eventos próximos se juntam
Atividades do mesmo tipo separadas por menos que `eventoJuntarSegundos` SHALL formar um único evento, e nenhum evento SHALL passar de `eventoMaxSegundos`.

#### Scenario: dois latidos seguidos
- **WHEN** há dois latidos com 4 s entre eles e `eventoJuntarSegundos` é 10
- **THEN** sai um evento só, do primeiro ao último latido

### Requirement: Clipe do evento
Cada evento SHALL virar um clipe de `inicio − eventoPreSegundos` a `fim + eventoPosSegundos`, recortado dos trechos (atravessando a borda entre trechos quando preciso), em `gravacoes/clipes/AAAA-MM-DD/HH-MM-SS-<tipo>.mp4`, com miniatura `.jpg` de mesmo nome. Clipe de evento sem vídeo SHALL sair só com áudio, sem miniatura.

#### Scenario: evento na borda de dois trechos
- **WHEN** a janela do clipe começa no fim de um trecho e termina no seguinte
- **THEN** o clipe tem a duração da janela (±1 s) e toca sem buraco

#### Scenario: evento em so-som
- **WHEN** o evento acontece com a câmera desligada
- **THEN** o clipe tem só áudio e `miniatura` é `null`

### Requirement: Registro e aviso de eventos
Cada evento SHALL virar uma linha JSON em `gravacoes/eventos/AAAA-MM-DD.jsonl` (`id`, `inicio`, `fim` em ISO hora local com fuso, `tipo`, `intensidade`, `clipe`, `miniatura` relativos a `gravacoes/`), gravada depois do clipe e da miniatura, e SHALL ser emitida a quem se inscreveu com `aoEvento(fn)`.

#### Scenario: registro
- **WHEN** um evento termina e o clipe é gravado
- **THEN** a linha aparece no jsonl do dia e `aoEvento` recebe o mesmo objeto

### Requirement: Retenção dos clipes
O sistema SHALL apagar clipes e registros de dias mais velhos que `clipesDias` (padrão 30; `0` = nunca), sem tocar em `gravacoes/trechos/`.

#### Scenario: clipe velho
- **WHEN** há clipes de 31 dias atrás e `clipesDias` é 30
- **THEN** a pasta do dia e o jsonl do dia são apagados e os trechos ficam

### Requirement: Recorte de clipe com tempo limite
O recorte de cada clipe SHALL ter tempo limite de `clipeTimeoutSegundos`; ao estourar, o sistema SHALL matar o ffmpeg do recorte, registrar a falha no log e seguir com o próximo clipe da fila.

#### Scenario: Recorte travado
- **WHEN** o ffmpeg de um recorte não termina em `clipeTimeoutSegundos`
- **THEN** o processo é morto, o log diz qual clipe falhou e o próximo clipe da fila é recortado

### Requirement: Busca de trechos sem travar
Ao montar um clipe, o sistema SHALL sondar só os trechos que podem cobrir a janela do evento, com no máximo `clipeSondagensSimultaneas` sondagens ao mesmo tempo e tempo limite em cada uma.

#### Scenario: Buffer cheio
- **WHEN** há 240 trechos nos últimos 3 dias e um evento de 30 s pede clipe
- **THEN** só os trechos que cobrem a janela são sondados, nunca mais que o limite ao mesmo tempo

#### Scenario: ffprobe travado
- **WHEN** uma sondagem não termina dentro do tempo limite
- **THEN** o processo é morto, a falha vai ao log e a fila de clipes segue

### Requirement: Retenção dos clipes por espaço
Quando `clipesMaxGb` ou `discoLivreMinGb` são maiores que zero, o sistema SHALL apagar os dias de clipes mais antigos (pasta e `.jsonl`) até a pasta de clipes ficar abaixo de `clipesMaxGb` e o disco ter pelo menos `discoLivreMinGb` livres, sem tocar no dia de hoje nem em `gravacoes/guardados/`.

#### Scenario: Pasta de clipes acima do limite
- **WHEN** `clipesMaxGb` é 5 e os clipes somam 6 GB em 10 dias
- **THEN** os dias mais antigos são apagados até a soma ficar abaixo de 5 GB, e hoje fica

#### Scenario: Limites desligados
- **WHEN** as duas chaves são 0
- **THEN** a retenção segue só por `clipesDias`

### Requirement: Testes de clipe com ffmpeg real estáveis sob carga
Os testes de clipe que usam o ffmpeg real SHALL passar quando a suíte inteira roda com as demais suítes ao mesmo tempo e com o PC sob carga, sem depender de esperas aumentadas às cegas.

#### Scenario: Suíte inteira sob carga
- **WHEN** `npm test` roda 10 vezes seguidas, algumas com carga de CPU extra
- **THEN** todas as rodadas terminam verdes

