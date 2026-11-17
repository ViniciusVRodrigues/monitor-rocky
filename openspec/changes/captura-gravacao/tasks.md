## 1. Base
- [x] 1.1 `package.json`, `config.json` com padrões e `config.local.example.json`
- [x] 1.2 Leitura da configuração com sobreposição local e validação (testes)

## 2. Dispositivos
- [x] 2.1 Script que lista dispositivos dshow (parser testado)

## 3. Captura
- [x] 3.1 Montagem dos argumentos do ffmpeg (tee: trechos MP4 + HLS)
- [x] 3.2 Supervisor com reinício e espera crescente
- [x] 3.3 Buffer circular (limpeza por idade)

## 4. Estados, controle e áudio ao vivo (requisitos novos)
- [ ] 4.1 `design.md` e spec atualizados (feito); config ampliada (todas as chaves) e documentada
- [ ] 4.2 `montarArgs` por estado (`gravando`/`so-som`), saída PCM por pipe, fonte de teste (`lavfi`)
- [ ] 4.3 Supervisor: args por partida, `reiniciar`, ativar/desativar, consumir sempre o stdout, intervalo mínimo de 1,1 s
- [ ] 4.4 `gravador` (estados, persistência atômica em `estado.json`, `camera`, `iniciar`, `parar`)
- [ ] 4.5 `distribuidor` de áudio (sem pressão de volta, erros isolados) e `ouvir` no PC (ffplay)
- [ ] 4.6 Canal de controle (named pipe) e CLI `iniciar|parar|camera|ouvir|estado`
- [ ] 4.7 `iniciarMonitor` exportado para o ROCKY-3

## 5. Verificação real
- [ ] 5.1 Com a fonte de teste: estados, pipe de áudio e `ouvir` de ponta a ponta (~3 min)
- [ ] 5.2 Com a FHD Camera e o fifine (~3 min): trechos tocáveis com áudio, `aovivo/` atualizando, limpeza; testar se outro app abre a câmera durante a captura e registrar em `design.md`
- [ ] 5.3 README: cada chave de configuração, comandos, estrutura de pastas
