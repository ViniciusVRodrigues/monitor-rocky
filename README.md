# monitor-rocky

Babá eletrônica caseira para o Rocky, um filhote de 3 meses. Usa uma webcam e um microfone USB no PC (Windows), grava o tempo todo, marca os momentos em que há movimento ou barulho e mostra tudo numa página web vista de fora só pela rede privada do Tailscale.

## Como funciona (plano)

```
webcam + microfone ──ffmpeg──▶ gravação em trechos (MP4) + ao vivo (HLS)
                                     │
                     detector de movimento e de som ──▶ eventos (linha do tempo)
                                     │
                     servidor Node local (127.0.0.1)
                                     │
             Tailscale Serve (HTTPS só dentro da tailnet, sem Funnel)
                                     │
                               navegador / celular
```

- **Captura**: `ffmpeg` com DirectShow (Windows). Câmera e microfone configuráveis.
- **Gravação**: trechos de alguns minutos num buffer das últimas 4 horas (configurável); os eventos viram clipes guardados à parte.
- **Eventos**: movimento (diferença entre quadros) e som (volume acima do limiar, como latido ou choro), com miniatura.
- **Web**: ao vivo, linha do tempo do dia com os eventos e reprodução dos trechos.
- **Acesso remoto**: nada de porta aberta no roteador nem nada público. O servidor só escuta em `127.0.0.1`; o Tailscale Serve leva a página, com HTTPS, só a quem está na sua tailnet, e o servidor confere a identidade do Tailscale (veja [Acesso de fora](#acesso-de-fora-rocky-4)).

## Privacidade

As gravações ficam só no seu disco, fora do repositório (`gravacoes/` está no `.gitignore`). Nada é enviado para terceiros além do que passa pela tailnet (criptografada de ponta a ponta) quando alguém dela assiste.

## Requisitos

- Windows 10/11, Node.js 20+, `ffmpeg` no PATH
- Conta no Tailscale (plano gratuito) para ver de fora

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
gravacoes/guardados/<nome>/*.mp4            # o que a pessoa guardou; a limpeza nunca toca
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
| `fpsCamera` / `fps` | 30 / 15 | o que a câmera entrega / o que é gravado. A câmera desta máquina só entrega 30 fps em MJPEG a 720p; `null` abre a câmera no próprio `fps` (sem decodificar quadros jogados fora), para câmeras que aceitem |
| `preset`, `crf` | `veryfast`, 23 | qualidade do H.264 (crf menor = melhor) |
| `audioBitrate`, `audioHz`, `audioCanais` | `96k`, 44100, 1 | áudio AAC gravado |
| `trechoSegundos` | 60 | duração de cada trecho |
| `bufferHoras` | 4 | quanto tempo de trechos manter |
| `limpezaMinutos` | 5 | de quanto em quanto tempo limpar |
| `aovivoSegundos`, `aovivoSegmentos` | 2, 6 | tamanho e quantidade de pedaços do HLS |
| `aovivoConectarSegundos` | 15 | quanto esperar o ao vivo tocar na página antes de mostrar "Tentar agora" |
| `esperaReinicioSegundos`, `esperaReinicioMaxSegundos` | 1, 60 | espera ao reiniciar o ffmpeg (dobra até o máximo) |
| `estadoInicial` | `gravando` | estado se não houver `estado.json` |
| `canalControle` | `monitor-rocky` | nome do pipe de controle |
| `ouvirHz` | 24000 | taxa do áudio ao vivo (PCM mono); a detecção e o nível usam a mesma, e os dB medidos não mudam com ela |
| `ouvirGanhoDb` | 18 | ganho (dB) do som na página, PCM e MP3 (GainNode); 0 = sem ganho |
| `ouvirCompLimiarDb`, `ouvirCompJoelhoDb`, `ouvirCompRazao` | -18, 12, 12 | compressor depois do ganho, para um latido alto não estourar |
| `ouvirPcGanhoDb` | 18 | ganho (dB) do "ouvir no PC" (`ffplay -af volume`, com limitador); 0 = sem filtro |
| `saudeTimeoutMs` | 10000 | tempo máximo da checagem de dispositivos; passou, o ffmpeg é morto |
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
| `clipeCopiar` | `true` | recorta o clipe sem recodificar (corte no quadro-chave, a cada `aovivoSegundos`); `false` recodifica com `clipePreset`/`clipeCrf` para cortar certinho, gastando CPU a cada evento |
| `clipePreset`, `clipeCrf` | `veryfast`, 26 | qualidade do clipe quando `clipeCopiar` é `false` |
| `clipePrioridade` | `abaixo` | prioridade do ffmpeg que recorta clipes e miniaturas (mesmos valores de `ffmpegPrioridade`), para não disputar CPU com a captura |
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
| `logJanelaSegundos`, `logLinhasPorJanela` | 10, 20 | no máximo tantas linhas do ffmpeg por janela; o excesso vira "N linhas omitidas" e linhas iguais seguidas viram "(repetida N vezes)" |
| `logFilaMaxKB` | 1024 | fila da escrita do log do vigia; acima disso descarta e conta |
| `tarefaPrioridade` | 3 | prioridade da tarefa agendada, herdada pelo vigia e pelo monitor (0 a 10 do Agendador: 1 alta, 2–3 acima do normal, 4–6 normal, 7–8 abaixo; o padrão do Windows é 7). Acima do normal evita que outra carga deixe o Node sem ler as saídas do ffmpeg, o que trava a captura. Reinstale a tarefa para aplicar |
| `ffmpegPrioridade` | `acima` | prioridade do ffmpeg de captura: `abaixo`, `normal`, `acima` ou `alta`; evita que outra carga deixe a câmera sem CPU |
| `vigiaEsperaSegundos`, `vigiaEsperaMaxSegundos` | 2, 120 | espera ao subir o monitor de novo (dobra até o máximo) |
| `vigiaEstavelSegundos` | 60 | tempo de pé que zera a espera |
| `saudeIntervaloSegundos` | 60 | de quanto em quanto tempo checar câmera e microfone |
| `alertaFalhasSeguidas` | 3 | quedas seguidas do ffmpeg que viram alerta |
| `alertaEstavelSegundos` | 120 | sem falhas por esse tempo zera a contagem |
| `alertaToast` | `true` | mostrar o toast do Windows |

Ao parar o vigia, o monitor e o ffmpeg são encerrados à força (o último trecho, de até `trechoSegundos`, pode ficar incompleto).

## Servidor e página (ROCKY-3)

`npm install` (uma vez, traz o `hls.js`) e `npm start` sobem a captura e o servidor HTTP, que escuta só em `127.0.0.1`. Abra `http://127.0.0.1:8321/`. Acesso de fora só pelo Tailscale (veja [Acesso de fora](#acesso-de-fora-rocky-4)). Ctrl+C encerra tudo.

Chaves novas do `config.json` (sobrepostas por `config.local.json`):

| Chave | Padrão | Para quê |
| --- | --- | --- |
| `servidorPorta` | 8321 | porta do servidor (sempre em 127.0.0.1) |
| `hostsPermitidos` | `[]` | hosts extras aceitos no cabeçalho Host (ex.: `meu-pc.tail1234.ts.net`, o nome da máquina na tailnet) |
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
| `nivelPisoDb`, `nivelTetoDb` | -80, -20 | dBFS que vira barra vazia / barra cheia |
| `somAoAbrir` | true | a página abre com o som ao vivo ligado |

## Apagar e guardar gravações (ROCKY-14)

Na linha do tempo, cada clipe tem **Guardar** e **Apagar**, e cada bloco de trechos tem **Guardar**. No fim de cada hora há **Apagar esta hora**. Antes de apagar, a página sempre pede confirmação e diz quantos itens vão sair. Se o item que está tocando for apagado, o player volta ao ao vivo.

**Guardar** copia o clipe ou os trechos para `gravacoes/guardados/<dia>_<nome>/`. A limpeza de 4 h e a retenção dos clipes nunca tocam nessa pasta. A alternância **Guardados** no topo da linha do tempo lista as pastas guardadas, inclusive as copiadas à mão (qualquer subpasta com `.mp4`), e permite tocá-las em sequência ou apagá-las.

| Chave | Padrão | Para quê |
| --- | --- | --- |
| `guardadosPasta` | `guardados` | nome da pasta dos guardados, dentro de `pasta` |
| `guardarMaxArquivos` | 120 | máximo de arquivos num pedido de guardar |
| `apagarHoraTrechos` | true | "Apagar esta hora" leva junto a gravação contínua da hora (menos o trecho que está gravando) |

Rotas (todas `POST` com JSON e o cabeçalho `X-Rocky: 1`, como os controles):

- `/api/apagar/evento` `{ dia, id }`;
- `/api/apagar/hora` `{ dia, hora, ids?, trechos? }`;
- `/api/guardar` `{ urls, rotulo? }`;
- `/api/guardados/apagar` `{ nome }`.

`GET /api/guardados` lista os guardados. O contrato completo está em `openspec/changes/apagar-e-guardar-gravacoes/design.md`.

## Acesso de fora (ROCKY-4)

A página é vista de fora (celular, PC do trabalho, um convidado) pelo **Tailscale Serve**, que publica a porta do monitor com HTTPS **só dentro da sua tailnet** (a rede privada do Tailscale). Nada fica público: o servidor segue só em `127.0.0.1`, nenhuma porta é aberta no roteador ou no firewall, e o **Tailscale Funnel nunca é usado** (o script recusa ligar se encontrar Funnel ativo).

### Passo a passo

1. **Instale o Tailscale** no PC do monitor (https://tailscale.com/download/windows) e no celular (App Store ou Google Play). Entre com a mesma conta nos dois e, se o painel pedir, aprove a máquina.
2. No painel (https://login.tailscale.com/admin/dns), ligue o **MagicDNS** e os **HTTPS Certificates**. Anote o nome da máquina, algo como `meu-pc.tail1234.ts.net`.
3. No `config.local.json`, ponha esse nome em `hostsPermitidos` (minúsculas, sem porta e sem ponto no fim) e, se quiser, a lista de logins em `tailscaleLoginsPermitidos` (veja abaixo). Reinicie o monitor (`npm run remover-servico` e `npm run instalar-servico`, ou pare e rode `npm start` de novo): a configuração só é lida ao subir.
4. Rode `npm run tailscale -- ligar`. Ele confere que não há Funnel, liga o Serve em segundo plano (`tailscale serve --bg --https=443 http://127.0.0.1:<servidorPorta>`) e mostra o endereço. Se o nome não estiver em `hostsPermitidos`, ele avisa (sem isso a página responde 421).
5. No celular, com o Tailscale conectado, abra `https://meu-pc.tail1234.ts.net/`.
6. **Convidado**: no painel, em **Machines**, abra o PC do monitor e use **Share** para compartilhar só esta máquina com o e-mail do convidado. Ele instala o Tailscale, aceita o convite e abre o mesmo endereço. O login dele chega no cabeçalho de identidade; se a lista de logins tiver itens, acrescente o dele.

Outros comandos: `npm run tailscale -- estado` (Serve ligado ou não, Funnel, endereço) e `npm run tailscale -- desligar` (remove só esta entrada do Serve; nada mais é visto de fora).

### Quem pode entrar

O Serve manda em todo pedido o cabeçalho `Tailscale-User-Login` com o login de quem abriu (e apaga o que o cliente tentar mandar). O servidor trata como **de fora** todo pedido com Host diferente de `127.0.0.1:<porta>`/`localhost:<porta>`, com `X-Forwarded-For` ou com esse cabeçalho, e então:

- sem identidade do Tailscale, recusa sempre (403), mesmo com a lista vazia. Isso cobre o Funnel e máquinas com tag, que não mandam identidade;
- com `tailscaleLoginsPermitidos` vazio, aceita qualquer pessoa da tailnet (inclusive quem recebeu a máquina compartilhada);
- com a lista preenchida, só aceita os logins dela (sem diferenciar maiúsculas).

A página aberta no próprio PC (`http://127.0.0.1:8321/`) segue sem login.

| Chave | Padrão | Para quê |
| --- | --- | --- |
| `tailscaleLoginsPermitidos` | `[]` | logins do Tailscale (e-mails) que podem ver de fora; vazio = qualquer pessoa da tailnet |
| `tailscaleExe` | `tailscale` | caminho do `tailscale.exe`, se não estiver no PATH |
| `tailscaleHttpsPorta` | 443 | porta HTTPS do Serve na tailnet (com outra porta, o host em `hostsPermitidos` leva `:porta`) |

Referências: [Tailscale Serve](https://tailscale.com/kb/1312/serve) (cabeçalhos de identidade, uso com localhost) e [`tailscale serve`](https://tailscale.com/docs/reference/tailscale-cli/serve.md) (sintaxe).

## Estado

Em construção. Especificação e decisões em [`openspec/`](openspec/). Licença MIT.
