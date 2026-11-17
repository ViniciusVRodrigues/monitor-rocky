## ADDED Requirements

### Requirement: Configuração de dispositivos fora do código
O sistema SHALL ler os nomes da câmera e do microfone, a pasta de gravações, a duração do trecho (padrão 60 s) e as horas de buffer (padrão 4) de `config.json`, sobrepostos por `config.local.json` quando existir. Nenhum nome de dispositivo SHALL estar fixo no código.

#### Scenario: config local sobrepõe a padrão
- **WHEN** `config.local.json` define `video` como `FHD Camera`
- **THEN** a captura usa `FHD Camera`, mantendo os demais valores de `config.json`

#### Scenario: dispositivo não configurado
- **WHEN** `video` ou `audio` está vazio
- **THEN** a captura não inicia e mostra mensagem em pt-BR sugerindo `npm run dispositivos`

### Requirement: Listar dispositivos
O sistema SHALL oferecer `npm run dispositivos`, que lista as câmeras e os microfones DirectShow pelo nome exato a pôr na configuração.

#### Scenario: listagem
- **WHEN** a pessoa roda `npm run dispositivos`
- **THEN** vê duas listas, vídeo e áudio, com os nomes exatos

### Requirement: Gravação em trechos
O sistema SHALL gravar câmera e microfone num único processo ffmpeg, em trechos MP4 de duração configurável, em `gravacoes/trechos/AAAA-MM-DD/HH-MM-SS.mp4` (hora local de início do trecho).

#### Scenario: trechos contínuos
- **WHEN** a captura roda por 3 minutos com trechos de 60 s
- **THEN** existem ao menos 2 trechos MP4 tocáveis, com vídeo e áudio, nomeados pela hora de início

### Requirement: Ao vivo em HLS
O mesmo processo SHALL gerar HLS ao vivo em `gravacoes/aovivo/index.m3u8`, com janela curta de segmentos que são apagados ao sair da lista.

#### Scenario: playlist ao vivo
- **WHEN** a captura está rodando
- **THEN** `gravacoes/aovivo/index.m3u8` existe e aponta segmentos recentes

### Requirement: Buffer circular
O sistema SHALL apagar os trechos cuja hora de início é mais antiga que o limite de horas de buffer, e as pastas de dia que ficarem vazias. Nada fora de `gravacoes/trechos/` SHALL ser apagado.

#### Scenario: trecho velho
- **WHEN** existe um trecho de 5 h atrás e o buffer é de 4 h
- **THEN** a limpeza apaga esse trecho e mantém os de menos de 4 h

### Requirement: Reinício do ffmpeg
Se o ffmpeg terminar sem ser pedido, o sistema SHALL reiniciá-lo com espera crescente (até 60 s) e registrar o motivo no log.

#### Scenario: ffmpeg cai
- **WHEN** o processo ffmpeg sai com erro
- **THEN** é reiniciado após a espera e o log registra o código de saída

### Requirement: Estados da captura
O sistema SHALL ter três estados: `gravando` (câmera + microfone), `so-som` (câmera liberada, grava só o áudio) e `parado` (nenhum dispositivo aberto). A troca SHALL ocorrer sem reiniciar o programa, e o estado SHALL ser guardado em `gravacoes/estado.json` e restaurado na partida (padrão `gravando` se não houver arquivo).

#### Scenario: desligar a câmera
- **WHEN** o estado muda de `gravando` para `so-som`
- **THEN** o ffmpeg é reaberto sem `video=` (a câmera fica livre para outros apps) e os trechos seguintes têm só áudio

#### Scenario: parar
- **WHEN** o estado vai para `parado`
- **THEN** nenhum ffmpeg roda, câmera e microfone ficam livres e o `aovivo/` é esvaziado

#### Scenario: sobrevive a reinício
- **WHEN** o programa é reiniciado com `estado.json` em `so-som`
- **THEN** ele volta em `so-som`

### Requirement: Trechos só de áudio
No estado `so-som` os trechos SHALL manter o mesmo caminho e padrão de nome, contendo só áudio (AAC em MP4), e o HLS SHALL ser só de áudio.

#### Scenario: trecho de áudio
- **WHEN** a captura roda em `so-som`
- **THEN** `trechos/AAAA-MM-DD/HH-MM-SS.mp4` existe, toca e não tem stream de vídeo

### Requirement: Controle por comando
O sistema SHALL aceitar comandos `npm run iniciar`, `npm run parar`, `npm run camera -- desligar|ligar`, `npm run ouvir -- ligar|desligar` e `npm run estado` por um canal local (named pipe, nome configurável, sem porta TCP). Sem o monitor rodando, o comando SHALL avisar em pt-BR para rodar `npm start`. O controle SHALL estar exposto como módulo (`gravador`) para o ROCKY-3.

#### Scenario: monitor não está rodando
- **WHEN** a pessoa roda `npm run parar` sem o monitor ativo
- **THEN** vê a mensagem sugerindo `npm start`, com código de saída diferente de zero

#### Scenario: câmera liga e desliga
- **WHEN** `npm run camera -- desligar` e depois `ligar`
- **THEN** o estado vai de `gravando` a `so-som` e volta a `gravando`

### Requirement: Distribuidor de áudio ao vivo
O mesmo ffmpeg SHALL emitir PCM 16 bits mono por pipe, que o Node SHALL sempre consumir e entregar aos inscritos do distribuidor. Inscrito lento ou com erro SHALL perder blocos sem atrasar a gravação nem derrubar o programa.

#### Scenario: inscrito lento
- **WHEN** um inscrito não consome o áudio
- **THEN** os blocos para ele são descartados e os demais inscritos e a gravação seguem normais

### Requirement: Ouvir no PC
O sistema SHALL tocar o áudio ao vivo nas caixas do PC (ffplay no dispositivo de saída padrão), ligável e desligável sem reiniciar o ffmpeg nem cortar a gravação.

#### Scenario: ouvir sem cortar a gravação
- **WHEN** `npm run ouvir -- ligar` e depois `desligar`
- **THEN** o ffmpeg continua o mesmo processo e os trechos seguem sem lacuna

### Requirement: Tudo configurável
Dispositivos, resolução, fps, qualidade, bitrate de áudio, duração do trecho, horas de buffer, janela do HLS, pastas, nome do canal de controle, espera de reinício e parâmetros do áudio ao vivo SHALL vir de `config.json`/`config.local.json`, todos documentados no README. Não há agenda de horários para liberar a câmera: só botão ou comando.

#### Scenario: ajuste sem código
- **WHEN** `config.local.json` define `trechoSegundos: 30`
- **THEN** os trechos passam a ter 30 s sem mexer em código
