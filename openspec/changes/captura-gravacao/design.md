## Estados da captura

| Estado    | ffmpeg                          | Câmera       | Grava                         |
|-----------|---------------------------------|--------------|-------------------------------|
| `gravando`| 1 processo (câmera + microfone) | aberta       | trechos MP4 com vídeo + áudio, HLS |
| `so-som`  | 1 processo (só microfone)       | **liberada** | trechos MP4 só com áudio, HLS só de áudio |
| `parado`  | nenhum                          | liberada     | nada (o `aovivo/` é limpo)    |

A troca fecha o ffmpeg com `q` (finaliza o trecho), espera ao menos 1,1 s (nomes de trecho têm resolução de segundo; evita sobrescrever) e abre de novo com os argumentos do novo estado, sem passar pela espera crescente de queda. O estado vive em `gravacoes/estado.json` (fora do git) e é lido na partida.

## Trechos só de áudio

Mesmo caminho e mesmo padrão de nome (`trechos/AAAA-MM-DD/HH-MM-SS.mp4`), contendo só AAC em MP4. Navegadores tocam num `<video>`/`<audio>`; a limpeza e a estrutura de pastas não mudam. Consequência para os próximos cartões: **quem lê trecho não pode supor vídeo**. O ROCKY-2 deve checar se o trecho tem stream de vídeo antes de detectar movimento (ou consultar o `estado.json`), e o ROCKY-3 deve tocar trecho sem vídeo como áudio.

## Câmera compartilhada (conclusão da pesquisa)

O DirectShow abre a câmera de forma exclusiva por padrão: com o app Câmera, Teams ou outro segurando o dispositivo, o ffmpeg falha com "Could not run graph (device already in use)", e o contrário também vale. A Microsoft documenta o compartilhamento da mesma câmera entre um app DirectShow e outros só com o "DShow Bridge" do Frame Server, que depende do driver/UVC e de configuração do Windows ([guia do DShow Bridge](https://learn.microsoft.com/en-us/windows-hardware/drivers/stream/dshow-bridge-implementation-guidance-for-usb-video-class-devices)). O Windows 11 24H2 traz ainda a opção "câmera em vários apps" ([Windows Latest](https://windowslatest.com/2024/08/21/windows-11-24h2-will-finally-allow-multiple-apps-to-use-your-camera-at-the-same-time), [Windows Forum](https://windowsforum.com/news/how-to-share-one-webcam-between-obs-teams-and-zoom-in-windows-11.447049/)), cuja disponibilidade depende da build e que mexe em configuração do sistema. Alterar essas configurações ou instalar câmera virtual (OBS etc.) está fora do escopo (decisão da pessoa). **Caminho adotado: o estado `so-som`**, que solta o dispositivo de verdade (processo sem `video=`) e continua ouvindo.

## Canal de controle

Named pipe local (`\\.\pipe\<canalControle>`; em outros sistemas, socket em pasta temporária), nome configurável. Nenhuma porta TCP é aberta, então páginas do navegador não alcançam o canal e não há conflito com o servidor do ROCKY-3. Protocolo: uma linha JSON por pedido (`{"cmd":"estado"}`) e uma de resposta (`{"ok":true,...}`). O CLI (`npm run iniciar|parar|camera|ouvir|estado`) é só um cliente. O ROCKY-3 não usa o canal: importa o `gravador` e o `distribuidor` do mesmo processo (`iniciarMonitor` em `src/captura.js`).

## Áudio ao vivo

O mesmo ffmpeg ganha uma saída extra `-f s16le pipe:1` (PCM 16 bits, mono, `ouvirHz`, padrão 16 kHz). O Node **sempre** consome o stdout (mesmo sem ouvintes; senão o pipe encheria e o ffmpeg travaria a gravação) e entrega ao `distribuidor`. Ouvinte lento ou quebrado perde blocos e nunca segura o ffmpeg. "Ouvir no PC" = `ffplay -nodisp` alimentado pelo distribuidor, ligado e desligado sem reiniciar o ffmpeg. O ffplay não escolhe dispositivo de saída: toca no dispositivo padrão do Windows (comando e argumentos configuráveis em `ouvirComando` e `ouvirArgs`).

## Fonte de teste

`fonte: "teste"` troca o DirectShow por `lavfi` (padrão de teste + tom), em tempo real, para provar estados, pipe e `ouvir` sem câmera.

## Teste de compartilhamento (2026-11-17, FHD Camera, Windows 11)

- Com o app Câmera do Windows aberto, o ffmpeg não abriu a câmera ("Could not run graph / device already in use"): o app prende o dispositivo.
- Com o monitor capturando, um segundo `ffmpeg -f dshow -i video="FHD Camera"` falhou com "Error opening input: I/O error": o ffmpeg também prende o dispositivo.
- Conclusão: sem configuração de sistema, não há compartilhamento. Para usar a câmera em outro app, use `npm run camera -- desligar` (estado `so-som`) e depois `ligar`.
