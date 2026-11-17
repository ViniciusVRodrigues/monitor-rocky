## Visão geral

```
ffmpeg (gravando) ──pipe:1 PCM s16le──▶ distribuidor ──▶ detector de som ──┐
       └──saída extra: quadros cinza W×H ──▶ pipe nomeado ──▶ detector de movimento ──┤
                                                                                 ▼
                                               agregador (por tipo) ── evento fechado
                                                                                 ▼
                         recorte dos trechos (concat + recodificação) → clipe .mp4 + .jpg
                                                                                 ▼
                                     linha em eventos/AAAA-MM-DD.jsonl → aoEvento(registro)
```

## Contrato (combinado com o ROCKY-3; não mudar sem avisar a coordenadora)

- Clipe: `gravacoes/clipes/AAAA-MM-DD/HH-MM-SS-<tipo>.mp4`; miniatura `.jpg` de mesmo nome.
- Registro por dia: `gravacoes/eventos/AAAA-MM-DD.jsonl`, uma linha por evento:
  `{"id","inicio","fim","tipo":"movimento"|"som","intensidade","clipe","miniatura"}`
  - `inicio`/`fim`: ISO em hora local com fuso (`2026-11-17T14:03:05-03:00`), sem milissegundos; são os limites da atividade (sem pré/pós).
  - `intensidade`: 0..1 (som: `(dB máx − limiar) / (0 − limiar)`; movimento: maior fração de pixels mudados).
  - `clipe`, `miniatura`: caminhos relativos a `gravacoes/` com `/` (ex.: `clipes/2026-11-17/14-03-00-som.mp4`). `miniatura` é `null` em clipe só de áudio; `clipe` e `miniatura` são `null` se o recorte falhar (o evento é registrado mesmo assim).
  - `id`: nome-base do clipe com o dia (`2026-11-17_14-03-00-som`); se já existir, ganha sufixo `-2`, `-3`.
  - O nome do clipe usa a hora de início do clipe (início − pré); o dia do arquivo e do jsonl é a data local desse início.
- `aoEvento(fn)` (devolve a função de cancelar): chamado **uma vez por evento**, depois de clipe, miniatura e linha do jsonl gravados, com o mesmo objeto da linha. Não há aviso de "começou".
- Ordem atômica: clipe gerado em `.tmp.mp4` e renomeado, miniatura, linha no jsonl (append de uma linha inteira), emissão. O ROCKY-3 nunca vê uma linha apontando arquivo inexistente.

## Som

PCM s16le mono em `ouvirHz` vindo do `distribuidor.inscrever`. Janelas de `somJanelaMs`; em cada uma, RMS em dBFS (`20·log10(rms/32768)`). Guarda o byte ímpar e a janela incompleta entre blocos. Janela acima de `somLimiarDb` conta como ativa; a atividade só vale depois de `somDuracaoMinimaMs` seguidos acima (evita clique isolado). Detecção por energia é o que se usa em babá eletrônica e detectores simples de latido; filtro por frequência ficou de fora (o volume já separa latido/choro do silêncio da casa, e o limiar é ajustável).

## Movimento

Saída extra do mesmo ffmpeg, só no estado `gravando`: `-map 0:v -vf fps=F,scale=W:H,format=gray -f rawvideo -y \\.\pipe\<prefixo>-<pid>` (W = `movimentoLargura`, H calculado de `resolucao` mantendo a proporção e arredondado para par; o JS usa os mesmos W×H). O Node abre um servidor no pipe antes de iniciar o ffmpeg e aceita uma conexão por partida do ffmpeg. Em `so-som` a saída não existe, então não há movimento.

- Quadro a quadro: fração de pixels com `|a−b| > movimentoLimiarPixel`; acima de `movimentoAreaMinima` em `movimentoQuadrosSeguidos` quadros seguidos = ativo.
- Cada conexão tem seu resto de bytes e zera o quadro anterior (não gera movimento falso ao reiniciar).
- O pipe é **sempre** esvaziado e o handler nunca lança erro: se o Node parasse de ler, o ffmpeg travaria trechos e HLS.
- Em outros sistemas o caminho é `unix:<tmp>/<prefixo>-<pid>.sock` (só por completude; o alvo é Windows).
- `scdet`/`select=gt(scene,…)` foram descartados: medem corte de cena, não um filhote andando num canto do quadro.

Teste prévio (2026-11-17, ffmpeg 9, Node 24): `net.createServer().listen('\\\\.\\pipe\\x')` e ffmpeg com `-f rawvideo -y \\.\pipe\x` entregaram 20 quadros em 1 conexão. O servidor precisa estar ouvindo antes do ffmpeg abrir ([ffmpeg-user, pipes nomeados no Windows](https://ffmpeg.org/pipermail/ffmpeg-user/2016-April/031941.html)).

## Agregador

Um por tipo. `atividade(t, intensidade)` abre ou estende o evento; `verificar(t)` fecha quando `t − última atividade ≥ eventoJuntarSegundos` (atividades mais próximas que isso viram um evento só: é o "tempo mínimo entre eventos") e corta o evento em `eventoMaxSegundos` (ruído contínuo, como TV, não vira evento infinito; a atividade seguinte abre outro). Relógio injetado nos testes. No `parar`, eventos abertos são fechados e recortados.

## Recorte

Janela `[inicio − eventoPreSegundos, fim + eventoPosSegundos]`. Espera `fim + pos + clipeMargemSegundos` antes de recortar (os fragmentos do fMP4 saem a cada `aovivoSegundos`).

- Trechos: `trechos/AAAA-MM-DD/HH-MM-SS.mp4`. Início = nome (hora local, resolução de 1 s); fim = duração lida com ffprobe (o trecho não tem exatamente `trechoSegundos`: o corte cai em keyframe e há reinícios e buracos). Escolhe os que cruzam a janela, inclusive o que ainda está sendo escrito.
- Concat demuxer com `inpoint`/`outpoint` por arquivo e **recodificação** (libx264 `clipePreset`/`clipeCrf`, AAC). A cópia de stream arredonda para o keyframe (GOP de 2 s) e o concat tem problemas conhecidos com inpoint/outpoint em cópia ([trac #8464](https://trac.ffmpeg.org/ticket/8464), [trac #5907](https://trac.ffmpeg.org/ticket/5907)); um clipe de ~30 s recodificado custa pouco e fecha as bordas certinho.
- Se algum trecho da janela não tem vídeo (evento em `so-som`, ou que atravessa a troca de estado), o clipe sai **só com áudio** (`-vn`) e sem miniatura.
- Miniatura: um quadro do clipe no instante de maior intensidade (ou no início da atividade), largura `miniaturaLargura`.
- Sem trechos na janela (estado `parado`, buffer já limpo): registra com `clipe: null`.

## Retenção

`clipesDias` (padrão 30; `0` = nunca apagar): apaga `clipes/AAAA-MM-DD/` e `eventos/AAAA-MM-DD.jsonl` de dias mais velhos que o limite, pelo nome, no mesmo intervalo da limpeza do buffer. Nunca toca em `trechos/`.

## Configuração

Chaves novas validadas em `src/deteccao/config.js` (não no `config.js` do ROCKY-1, que o ROCKY-3 também edita). Ver README.

## Ligação

`iniciarMonitor` cria a detecção (se `deteccao` for verdadeiro), passa `saidasExtras` como função do estado e devolve `deteccao` (`aoEvento`). O `npm start` não muda.
