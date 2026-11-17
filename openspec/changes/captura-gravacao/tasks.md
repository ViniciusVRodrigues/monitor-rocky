## 1. Base
- [ ] 1.1 `package.json` (ESM, Node >= 20, `npm test`, `npm run dispositivos`, `npm start`), `config.json` com padrões e `config.local.example.json`
- [ ] 1.2 Leitura da configuração com sobreposição local e validação (testes)

## 2. Dispositivos
- [ ] 2.1 Script que roda `ffmpeg -list_devices true -f dshow -i dummy` e extrai vídeo e áudio (parser testado com saída de exemplo)

## 3. Captura
- [ ] 3.1 Montagem dos argumentos do ffmpeg (trechos MP4 com `segment` + `strftime`, e HLS ao vivo) como função pura testada
- [ ] 3.2 Supervisor do processo com reinício e espera crescente (testado com processo falso)
- [ ] 3.3 Buffer circular: limpeza por idade (testada com pasta temporária)

## 4. Verificação real
- [ ] 4.1 Rodar com os dispositivos desta máquina por ~3 min: trechos MP4 tocáveis com áudio, `aovivo/index.m3u8` atualizando, limpeza funcionando
- [ ] 4.2 README: como configurar e rodar
