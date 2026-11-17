# monitor-rocky

Babá eletrônica para o cachorro (Rocky): captura câmera e microfone no Windows com ffmpeg, grava em trechos, detecta movimento e som, e serve uma página web exposta pelo Cloudflare Tunnel atrás do Cloudflare Access (login Google).

- Stack prevista: Node >= 20 (ESM, sem build), UI estática em `web/` (JS puro, textos em pt-BR), testes com `node --test`. ffmpeg via processo filho.
- Dispositivos desta máquina (DirectShow): vídeo `FHD Camera`, áudio `Microfone (fifine  Microphone)` (dois espaços). Nunca fixe no código: vem da configuração.
- Segurança é requisito: servidor só em `127.0.0.1`; acesso externo só pelo túnel; validar o `Cf-Access-Jwt-Assertion` (assinatura, `aud`, e-mail na lista); nada de segredo ou gravação no git (`config.local.json`, `.env`, `gravacoes/` no `.gitignore`); repositório é público.
- Especificação e decisões: `openspec/` (uma change por cartão). Quadro: `.claude/quadro.md`.
