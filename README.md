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
2. Copie `config.local.example.json` para `config.local.json` (não vai para o git) e ajuste `video` e `audio` (atenção aos espaços duplos nos nomes). Os padrões ficam em `config.json`: `pasta` (`gravacoes`), `trechoSegundos` (60), `bufferHoras` (4), `fpsCamera` (30, o que a câmera entrega), `fps` (15, o que é gravado), `resolucao`.
3. `npm start` inicia o ffmpeg (um processo, câmera + microfone) e a limpeza. `Ctrl+C` encerra. Se o ffmpeg cair, reinicia com espera crescente (até 60 s) e registra o motivo.
4. `npm test` roda os testes.

Estrutura gerada em `gravacoes/` (hora local):

```
gravacoes/trechos/AAAA-MM-DD/HH-MM-SS.mp4   # trechos de 60 s; só os das últimas 4 h
gravacoes/aovivo/index.m3u8 (+ seg*.ts)     # HLS ao vivo, janela curta
```

Se o ffmpeg disser "device already in use", feche o app Câmera, Teams, Discord ou abas que estejam usando a câmera.

## Estado

Em construção. Especificação e decisões em [`openspec/`](openspec/). Licença MIT.
