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
- **Gravação**: trechos de alguns minutos em disco, com retenção configurável (apaga os mais antigos).
- **Eventos**: movimento (diferença entre quadros) e som (volume acima do limiar, como latido ou choro), com miniatura.
- **Web**: ao vivo, linha do tempo do dia com os eventos e reprodução dos trechos.
- **Acesso remoto**: nada de porta aberta no roteador. O servidor só escuta em `127.0.0.1`; o `cloudflared` cria o túnel e o Cloudflare Access exige login Google antes de chegar ao PC. O servidor também confere o JWT do Access.

## Privacidade

As gravações ficam só no seu disco, fora do repositório (`gravacoes/` está no `.gitignore`). Nada é enviado para terceiros além do que passa pelo túnel quando alguém logado assiste.

## Requisitos

- Windows 10/11, Node.js 20+, `ffmpeg` no PATH
- Conta Cloudflare com um domínio (para o túnel com nome e o Access)

## Estado

Em construção. Especificação e decisões em [`openspec/`](openspec/). Licença MIT.
