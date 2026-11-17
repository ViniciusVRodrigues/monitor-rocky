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
