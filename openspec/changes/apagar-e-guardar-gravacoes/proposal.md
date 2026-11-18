# Apagar e guardar gravações pela página (ROCKY-14)

Issue: https://github.com/ViniciusVRodrigues/monitor-rocky/issues/15

## Por quê
A pessoa grava muitos clipes de si mesma e hoje só consegue apagá-los à mão no disco. Em 2026-11-17 o único vídeo que importava (o Rocky, às 16:52) estava num trecho da gravação contínua, que a limpeza de 4 h apagaria. Ele foi copiado à mão para `gravacoes/guardados/2026-11-17-rocky/`.

## O que muda
- Na linha do tempo: apagar um clipe de cada vez ou a hora inteira, sempre com confirmação, porque apagar é definitivo.
  - Apagar a hora remove os clipes, os eventos e os trechos da gravação contínua daquela hora. Ficam o trecho que está gravando agora e tudo o que está em `guardados/` (decisão da pessoa em 2026-11-17, opção "Clipes e trechos").
  - A confirmação mostra a contagem: "Apagar 5 clipes e 12 trechos das 16h? Não dá para desfazer."
- Guardar um trecho ou clipe: copiar para `gravacoes/guardados/`, fora da limpeza de 4 h e da retenção dos clipes.
- A página lista os guardados, com tocar e apagar.
- Rotas novas no servidor, com as mesmas proteções dos controles atuais: só 127.0.0.1, sem path traversal, só dentro de `gravacoes/`.
- Apagar remove a linha correspondente do `.jsonl` de eventos.
- Pastas, limites e textos ficam configuráveis em `config.json`, com cada chave documentada.
- Layout responsivo em 390, 768, 1280 e 1920 px.

## Impacto
Specs `pagina` e `servidor`. Áreas: `src/` (servidor e retenção), `web/` (linha do tempo), `config.json` e `README`.
