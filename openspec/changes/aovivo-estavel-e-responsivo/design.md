# Design: ao vivo estável, som e responsivo

## Causas medidas (2026-11-17)

1. **CPU.** A tarefa agendada não tem `<Priority>`; o padrão do Agendador é 7 (abaixo do normal) e os filhos herdam. Com outra carga na máquina (um Playwright de outro projeto a ~740% de CPU), o ffmpeg de produção ficou com 1% de um núcleo, o buffer da câmera (`rtbuf`) encheu a 85% e vieram os "frame dropped". Escada de testes: ffmpeg sozinho, 5 min limpo; com o servidor sem página, limpo; com a página, quedas depois de 54 s, coerente com disputa de CPU.
2. **Player.** O Chrome 156 responde `maybe` a `canPlayType('application/vnd.apple.mpegurl')` (HLS nativo chegou ao Chrome). O `aovivo.js` testa o nativo antes do hls.js, então o Chrome usa o HLS nativo, que travou em ~6 s (buffer parado em 5,5 s) e pediu o playlist centenas de vezes (206). A ordem recomendada pelo hls.js é o contrário: `Hls.isSupported()` primeiro, nativo como reserva (README do hls.js, seção "Getting started"). Além disso, todo evento `estado` do SSE (inclusive a reconexão) recria o player (`app.js`, `forcar=true`).
3. **Decodificação à toa.** A câmera abre a 30 fps (`fpsCamera`) e a saída é 15 fps: metade dos quadros MJPEG é decodificada e jogada fora.
4. **Barra de nível.** O piso é -60 dBFS e o microfone fica perto de -77 dBFS num quarto quieto: a barra fica sempre vazia.

## Decisões

- **Prioridade configurável.** `tarefaPrioridade` (padrão 4, normal, no XML do Agendador, escala 0–10) e `ffmpegPrioridade` (padrão `acima`, mapeado a `os.constants.priority.PRIORITY_ABOVE_NORMAL`; aceita `normal`, `acima`, `alta`). O supervisor chama `os.setPriority(pid, …)` logo depois do spawn; falha só vai ao log. Nunca `tempo real`. Reinstalar a tarefa (`npm run instalar-servico`) aplica a prioridade da tarefa.
- **`fpsCamera` igual a `fps` quando a câmera aceita.** `null` = usa `fps`. Medido em 2026-11-17: a FHD Camera só abre 1280x720 MJPEG a 30 fps ("Could not set video options" a 15), então o `config.json` fica em 30; o código aceita `null` para outras câmeras.
- **Log do stderr do ffmpeg.** Junta em linhas inteiras (um pedaço pode cortar a linha) e limita por intervalo: no máximo `logLinhasPorJanela` linhas a cada `logJanelaSegundos`; o excedente vira uma linha "N linhas omitidas". Linhas iguais seguidas viram "(repetida N vezes)".
- **Vigia.** Escrita do log assíncrona (`fs.createWriteStream` em modo append) em vez de síncrona, com limite de fila: acima dele descarta e conta.
- **Player.** hls.js primeiro; nativo só sem MSE. O player só é recriado quando o estado muda ou a pessoa pede ("Tentar agora", "Voltar ao ao vivo"). hls.js com `liveSyncDurationCount: 3`, recuperação de erro de mídia (`recoverMediaError`) antes de recriar, e `timerConectar` só até o primeiro `playing`.
- **Nível.** `nivelPisoDb` padrão -80 e `nivelTetoDb` novo (padrão -20): o mapeamento vai de `[piso, teto]` a `[0, 1]`, com corte.
- **Layout.** Segue o plano do `ux-ui` (seção abaixo quando chegar).

## Pacotes

1. **Captura** (Node: `src/tarefa.js`, `src/supervisor.js`, `src/ffmpeg-args.js`, `src/vigia*.js`, `config.json`, README). Tarefas 1.x e 2.x.
2. **Player e nível** (`web/js/aovivo.js`, `web/js/app.js`, `src/servidor/nivel.js`, `src/servidor/ao-vivo.js`, config, README). Tarefas 3.1 e 3.2.
3. **Layout** (`web/css`, `web/index.html`). Tarefa 3.3. Depois do pacote 2 (mexe no mesmo HTML do player).

Pacotes 1 e 2 têm arquivos disjuntos e podem correr em paralelo.

## Riscos

- `os.setPriority` acima do normal precisa só do mesmo usuário (sem admin); `alta` pode pedir privilégio no Windows, por isso o padrão é `acima`. Teste: falha vira log, a captura sobe igual.
- Câmera que não aceita 15 fps em MJPEG: o dshow negocia; se falhar, o log diz e a config volta a 30.
- hls.js no Safari do Mac: tem MSE, usa hls.js; no iPhone sem MSE usa nativo. Nada muda para quem já funcionava.

## Testes

- Unidade: XML com `<Priority>`; `setPriority` chamado com o pid e o valor mapeado; falha só loga; `-framerate` igual a `-r` sem `fpsCamera`; stderr cortado no meio da linha vira uma linha; limite por janela e repetidas; nível com piso/teto; player escolhe hls.js quando `Hls.isSupported()` mesmo com `canPlayType` "maybe"; mesmo estado não recria.
- Navegador: 4 larguras com print; ao vivo tocando 2 min sem `waiting` longo.
- Aceite: 30 min na câmera real com a página aberta, sem "frame dropped".
