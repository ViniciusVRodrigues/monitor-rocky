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

### Para os próximos cartões

`import { iniciarMonitor } from './src/captura.js'` devolve `{ gravador, distribuidor, ouvinte, parar }`. `gravador` tem `estado()`, `iniciar()`, `parar()`, `camera('ligar'|'desligar')` e `aoMudar(fn)`. `distribuidor.inscrever(fn)` entrega o áudio PCM s16le mono (`ouvirHz`) e devolve a função de cancelar; o ffmpeg não reinicia ao inscrever ou sair. Aceita `saidasExtras` (saídas extras do ffmpeg, ex.: movimento no ROCKY-2).

## Estado

Em construção. Especificação e decisões em [`openspec/`](openspec/). Licença MIT.
