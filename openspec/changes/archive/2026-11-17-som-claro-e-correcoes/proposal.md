## Why

No preview antigo (ffplay direto do DirectShow, 44,1 kHz, sem filtro) a pessoa ouvia o Rocky alto e claro. Na página, o som sai em PCM de 16 kHz sem ganho e ficou baixo e abafado. O microfone direto mede média -73 dB e pico -54 dB numa sala quieta, então a captura não perde volume: o que falta é ganho e taxa no ouvir. No uso real também apareceram dois defeitos: o botão "Voltar ao ao vivo" fica bugado, e a checagem de saúde (`src/saude.js`) deixa processos `ffmpeg -list_devices` presos (havia 4 vivos).

Issue: https://github.com/ViniciusVRodrigues/monitor-rocky/issues/11

## What Changes

- Ganho configurável no som do site: GainNode com DynamicsCompressor para não estourar, no PCM e no MP3. Chave `ouvirGanhoDb` no `config.json`, documentada.
- Taxa do ouvir configurável, com padrão mais alto (24 ou 32 kHz) para dar clareza, sem mudar o que a detecção mede.
- Ganho opcional no "ouvir no PC" (ffplay com `-af volume`), por chave de config.
- O botão "Voltar ao ao vivo" volta ao ao vivo de forma limpa: player recriado, som e selo certos.
- A checagem de dispositivos em `src/saude.js` tem timeout e mata o processo. Nenhum `ffmpeg -list_devices` fica preso.

## Impact

- `web/js/ouvir.js`, `web/js/aovivo.js`, `web/js/app.js`, `src/saude.js`, o ouvinte do PC (`src/ouvir.js`), o distribuidor e os args do ffmpeg, se a taxa mudar, `config.json` e a documentação das chaves.
