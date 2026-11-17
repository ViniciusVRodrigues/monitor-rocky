## 1. P1 — Detectores e agregador (puro, sem ffmpeg)
- [ ] 1.1 `src/deteccao/config.js`: padrões e validação das chaves novas
- [ ] 1.2 `src/deteccao/tempo.js`: ISO local com fuso, nome de dia e hora
- [ ] 1.3 `src/deteccao/som.js`: RMS/dBFS em janelas, duração mínima, byte ímpar entre blocos
- [ ] 1.4 `src/deteccao/movimento.js`: quadros W×H remontados, fração de pixels, quadros seguidos, `reiniciar()`
- [ ] 1.5 `src/deteccao/agregador.js`: juntar, duração máxima, `encerrar()`

## 2. P2 — Clipes, registro e retenção (ffmpeg)
- [ ] 2.1 `src/deteccao/clipes.js`: achar trechos da janela (ffprobe), concat + recodificação, só áudio quando falta vídeo, miniatura, `.tmp` + rename
- [ ] 2.2 `src/deteccao/registro.js`: id único, linha no jsonl, limpeza por `clipesDias` sem tocar em `trechos/`
- [ ] 2.3 Testes de integração com trechos sintéticos (lavfi): dentro de um trecho, na borda, só áudio, misto

## 3. P3 — Ligação
- [ ] 3.1 `saidasExtras` como função do estado em `ffmpeg-args.js`; `-y` global (teste: `so-som` sem `0:v`)
- [ ] 3.2 `src/deteccao/pipe.js` (servidor do pipe de quadros) e `src/deteccao/index.js` (orquestra, `aoEvento`, limpeza periódica)
- [ ] 3.3 `iniciarMonitor` devolve `deteccao`; chaves no `config.json` e README
- [ ] 3.4 Ponta a ponta com `fonte: "teste"` (tom alto = som; testsrc = movimento)

## 4. Verificação real
- [ ] 4.1 Microfone real (`so-som`, sem abrir a câmera): palmas geram evento, clipe só de áudio e linha no jsonl
