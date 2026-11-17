# monitor-rocky

Babá eletrônica caseira para o Rocky, um filhote de 3 meses. Usa uma webcam e um microfone USB no PC (Windows), grava o tempo todo, marca os momentos em que há movimento ou barulho e mostra tudo numa página web protegida por login do Google.

## Como funciona (plano)

```
webcam + microfone ──ffmpeg──▶ gravação em trechos (MP4) + ao vivo (HLS)
                                     │
                     detector de movimento e de som ──▶ eventos (linha do tempo)
                                     │
                     servidor Node local (127.0.0.1)
                                     │
               Cloudflare Tunnel ──▶ Cloudflare Access (login Google, só e-mails liberados)
                                     │
                               navegador / celular
```

- **Captura**: `ffmpeg` com DirectShow (Windows). Câmera e microfone configuráveis.
- **Gravação**: trechos de alguns minutos num buffer das últimas 4 horas (configurável); os eventos viram clipes guardados à parte.
- **Eventos**: movimento (diferença entre quadros) e som (volume acima do limiar, como latido ou choro), com miniatura.
- **Web**: ao vivo, linha do tempo do dia com os eventos e reprodução dos trechos.
- **Acesso remoto**: nada de porta aberta no roteador. O servidor só escuta em `127.0.0.1`; o `cloudflared` cria o túnel e o Cloudflare Access exige login Google antes de chegar ao PC. O servidor também confere o JWT do Access.

## Privacidade

As gravações ficam só no seu disco, fora do repositório (`gravacoes/` está no `.gitignore`). Nada é enviado para terceiros além do que passa pelo túnel quando alguém logado assiste.

## Requisitos

- Windows 10/11, Node.js 20+, `ffmpeg` no PATH
- Conta Cloudflare com um domínio (para o túnel com nome e o Access)

## Captura e gravação (ROCKY-1)

1. `npm run dispositivos` lista câmeras e microfones DirectShow, com o nome exato.
2. Copie `config.local.example.json` para `config.local.json` (não vai para o git) e ajuste `video` e `audio` (atenção aos espaços duplos nos nomes). Qualquer chave de `config.json` pode ser sobrescrita ali.
3. `npm start` inicia o monitor (ffmpeg, limpeza, canal de controle). `Ctrl+C` encerra. Se o ffmpeg cair, reinicia com espera crescente e registra o motivo.
4. `npm test` roda os testes.

### Estados e comandos (com o monitor rodando)

| Comando | Efeito |
| --- | --- |
| `npm run iniciar` | volta a gravar (câmera e som) |
| `npm run parar` | para tudo (nada aberto) |
| `npm run camera -- desligar` | solta a câmera de verdade; o som segue gravando (`so-som`) |
| `npm run camera -- ligar` | volta a gravar com câmera |
| `npm run ouvir -- ligar` / `desligar` | toca o som ao vivo nas caixas do PC (dispositivo padrão do Windows, via ffplay) |
| `npm run estado` | mostra o estado |

O estado fica em `gravacoes/estado.json` e volta no próximo início. Os comandos falam com o monitor por um pipe nomeado local (`\\.\pipe\<canalControle>`), sem porta de rede. Não há agendamento: soltar a câmera é só por comando.

Câmera compartilhada: o app Câmera e o ffmpeg prendem o dispositivo cada um (testado; ver `openspec/changes/captura-gravacao/design.md`, com os links). Para usar a câmera em outro app, use `camera -- desligar`. Se aparecer "device already in use", feche o app que a está usando.

### Estrutura em `gravacoes/` (hora local)

```
gravacoes/trechos/AAAA-MM-DD/HH-MM-SS.mp4   # trechos; só os das últimas bufferHoras
gravacoes/aovivo/index.m3u8 (+ seg*.ts)     # HLS ao vivo, janela curta
gravacoes/estado.json                       # estado atual
```

Em `so-som` os trechos continuam `.mp4`, mas só com áudio AAC (sem vídeo); o HLS também fica só de áudio. Quem lê os trechos deve checar se há faixa de vídeo.

### Configuração (`config.json`)

| Chave | Padrão | Para quê |
| --- | --- | --- |
| `fonte` | `dshow` | `teste` usa imagem e tom sintéticos, sem câmera |
| `video`, `audio` | vazio | nomes DirectShow (em `config.local.json`) |
| `pasta` | `gravacoes` | onde gravar (relativa à raiz ou absoluta) |
| `ffmpeg` | `ffmpeg` | executável |
| `resolucao` | `1280x720` | tamanho do vídeo |
| `fpsCamera` / `fps` | 30 / 15 | o que a câmera entrega / o que é gravado |
| `preset`, `crf` | `veryfast`, 23 | qualidade do H.264 (crf menor = melhor) |
| `audioBitrate`, `audioHz`, `audioCanais` | `96k`, 44100, 1 | áudio AAC gravado |
| `trechoSegundos` | 60 | duração de cada trecho |
| `bufferHoras` | 4 | quanto tempo de trechos manter |
| `limpezaMinutos` | 5 | de quanto em quanto tempo limpar |
| `aovivoSegundos`, `aovivoSegmentos` | 2, 6 | tamanho e quantidade de pedaços do HLS |
| `esperaReinicioSegundos`, `esperaReinicioMaxSegundos` | 1, 60 | espera ao reiniciar o ffmpeg (dobra até o máximo) |
| `estadoInicial` | `gravando` | estado se não houver `estado.json` |
| `canalControle` | `monitor-rocky` | nome do pipe de controle |
| `ouvirHz` | 16000 | taxa do áudio ao vivo (PCM mono) |
| `ouvirComando`, `ouvirArgs` | `ffplay`, `[]` | player do "ouvir no PC" e argumentos extras |

## Eventos: movimento e som (ROCKY-2)

Com `npm start`, o monitor também detecta:

- **Som** (latido, choro): volume (RMS em dBFS) do áudio ao vivo acima de `somLimiarDb` por pelo menos `somDuracaoMinimaMs`. Funciona em `gravando` e em `so-som`.
- **Movimento**: o mesmo ffmpeg manda quadros cinza pequenos por um pipe nomeado local; conta-se a fração de pixels que mudou entre quadros. Só em `gravando` (com a câmera desligada não há movimento).

Atividades do mesmo tipo mais próximas que `eventoJuntarSegundos` viram um evento só. Cada evento vira um clipe recortado dos trechos (`eventoPreSegundos` antes e `eventoPosSegundos` depois), com miniatura, e uma linha no registro do dia. Os clipes ficam fora do buffer e são apagados depois de `clipesDias` dias (`0` = nunca); os trechos não são tocados.

```
gravacoes/clipes/AAAA-MM-DD/HH-MM-SS-<tipo>.mp4   # clipe (tipo: movimento | som); HH-MM-SS = início do clipe
gravacoes/clipes/AAAA-MM-DD/HH-MM-SS-<tipo>.jpg   # miniatura (não existe em clipe só de áudio)
gravacoes/eventos/AAAA-MM-DD.jsonl                # uma linha por evento
```

Linha do registro: `{"id","inicio","fim","tipo","intensidade","clipe","miniatura"}`. `inicio`/`fim` em ISO com fuso local (`2026-11-17T14:03:05-03:00`), limites da atividade; `intensidade` de 0 a 1; `clipe`/`miniatura` relativos a `gravacoes/` (ou `null`). No código: `monitor.deteccao.aoEvento(fn)` recebe o mesmo objeto, uma vez por evento, depois de o clipe e a linha estarem gravados.

Para calibrar: se aparecerem eventos de som demais, suba `somLimiarDb` (ex.: -25); de menos, desça (ex.: -40). Para movimento, `movimentoAreaMinima` (fração do quadro) e `movimentoLimiarPixel` (0 a 255).

| Chave | Padrão | Para quê |
| --- | --- | --- |
| `deteccao` | `true` | liga a detecção de eventos |
| `ffprobe` | `ffprobe` | executável usado para ler os trechos |
| `somLimiarDb` | -30 | volume (dBFS, negativo) acima do qual é som alto |
| `somJanelaMs` | 100 | tamanho da janela de medição do volume |
| `somDuracaoMinimaMs` | 200 | quanto tempo seguido acima do limiar para valer (evita clique) |
| `movimentoLargura`, `movimentoFps` | 160, 5 | tamanho e taxa dos quadros de análise |
| `movimentoLimiarPixel` | 25 | quanto um pixel precisa mudar (0 a 255) |
| `movimentoAreaMinima` | 0.01 | fração do quadro que precisa mudar |
| `movimentoQuadrosSeguidos` | 2 | quadros seguidos com mudança para valer |
| `movimentoCanal` | `monitor-rocky-movimento` | prefixo do pipe nomeado dos quadros (soma-se o PID) |
| `eventoPreSegundos`, `eventoPosSegundos` | 5, 5 | quanto o clipe pega antes e depois |
| `eventoJuntarSegundos` | 10 | tempo mínimo entre eventos: atividades mais próximas viram um só |
| `eventoMaxSegundos` | 120 | duração máxima de um evento (barulho contínuo vira vários) |
| `clipeMargemSegundos` | 10 | espera extra antes de recortar (o trecho em gravação chega ao disco com alguns segundos de atraso) |
| `clipePreset`, `clipeCrf` | `veryfast`, 26 | qualidade do clipe (é recodificado para cortar certinho) |
| `miniaturaLargura` | 320 | largura da miniatura |
| `clipesDias` | 30 | por quantos dias guardar clipes e registros (inteiro até 36500; `0` = sempre) |

### Para os próximos cartões

`import { iniciarMonitor } from './src/captura.js'` devolve `{ gravador, distribuidor, ouvinte, deteccao, parar }`. `gravador` tem `estado()`, `iniciar()`, `parar()`, `camera('ligar'|'desligar')` e `aoMudar(fn)`. `distribuidor.inscrever(fn)` entrega o áudio PCM s16le mono (`ouvirHz`) e devolve a função de cancelar; o ffmpeg não reinicia ao inscrever ou sair. Aceita `saidasExtras` (saídas extras do ffmpeg: lista ou função `(estado, { video, audio })`). `deteccao.aoEvento(fn)` avisa cada evento gravado.

## Rodar sozinho (ROCKY-5)

`npm run instalar-servico` cria uma **tarefa agendada** do Windows (nome em `servicoNome`) que sobe o vigia (`src/vigia.js`) sem janela quando você entra no Windows. É tarefa e não serviço porque serviços rodam na sessão 0, que não enxerga a câmera (DirectShow) nem mostra toast. Rodar de novo substitui a tarefa. `npm run remover-servico` remove a tarefa e encerra o vigia que estiver rodando. Para subir agora sem sair da conta: `schtasks /Run /TN monitor-rocky`.

O vigia roda o `npm start` (`src/principal.js`: monitor, detecção e a página em `http://127.0.0.1:<servidorPorta>/`); se ele cair, sobe de novo com espera crescente. Tudo vai para `logs/monitor.log` (rotaciona por tamanho). Também dá para rodá-lo à mão: `npm run vigia`.

**Alertas**: se a câmera ou o microfone somem (o ffmpeg falha `alertaFalhasSeguidas` vezes seguidas, ou o dispositivo não aparece na lista do DirectShow, checada a cada `saudeIntervaloSegundos`), o vigia mostra um toast do Windows e grava `gravacoes/saude.json` (`{"camera":"ok|sumiu","microfone":"ok|sumiu","captura":"ok|falhando","atualizadoEm":...}`) para a página mostrar. Em `parado` não há verificação; em `so-som` a câmera não é verificada. Gancho para o celular (ROCKY-6): `criarSaude({ aoAlerta })` em `src/saude.js` recebe `{ tipo, problema, mensagem, em }` a cada problema e recuperação.

| Chave | Padrão | Para quê |
| --- | --- | --- |
| `servicoNome` | `monitor-rocky` | nome da tarefa agendada |
| `logPasta` | `logs` | pasta do log do vigia |
| `logMaxMB`, `logArquivos` | 5, 5 | tamanho que dispara a rotação e quantos arquivos antigos manter |
| `vigiaEsperaSegundos`, `vigiaEsperaMaxSegundos` | 2, 120 | espera ao subir o monitor de novo (dobra até o máximo) |
| `vigiaEstavelSegundos` | 60 | tempo de pé que zera a espera |
| `saudeIntervaloSegundos` | 60 | de quanto em quanto tempo checar câmera e microfone |
| `alertaFalhasSeguidas` | 3 | quedas seguidas do ffmpeg que viram alerta |
| `alertaEstavelSegundos` | 120 | sem falhas por esse tempo zera a contagem |
| `alertaToast` | `true` | mostrar o toast do Windows |

Ao parar o vigia, o monitor e o ffmpeg são encerrados à força (o último trecho, de até `trechoSegundos`, pode ficar incompleto).

## Servidor e página (ROCKY-3)

`npm install` (uma vez, traz o `hls.js`) e `npm start` sobem a captura e o servidor HTTP, que escuta só em `127.0.0.1`. Abra `http://127.0.0.1:8321/`. Acesso de fora só pelo túnel (ROCKY-4). Ctrl+C encerra tudo.

Chaves novas do `config.json` (sobrepostas por `config.local.json`):

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
| `sseBatidaSegundos` | 15 | batida do fluxo de eventos |
| `linhaTempoAtualizarSegundos` | 30 | recarga do dia de hoje |
| `controleTempoLimiteSegundos` | 20 | tempo máximo de um controle |
| `nivelHz` | 10 | quantas vezes por segundo o nível do som vai para a página |
| `nivelSuavizacao` | 0.6 | queda suave da barra (0 a menos de 1); a subida é imediata |
| `nivelPisoDb` | -60 | dBFS que vira barra vazia |
| `somAoAbrir` | true | a página abre com o som ao vivo ligado |

## Estado

Em construção. Especificação e decisões em [`openspec/`](openspec/). Licença MIT.
