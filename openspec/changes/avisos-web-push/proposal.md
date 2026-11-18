# Avisos no celular por web push (ROCKY-6)

Issue: https://github.com/ViniciusVRodrigues/monitor-rocky/issues/32

## Por quê
A pessoa quer saber, longe de casa, quando o Rocky late ou chora muito, sem ficar olhando a página. Decisão de 2026-11-18: o aviso chega por notificação do navegador (web push), não pelo Telegram.

## O que muda
- A página vira instalável (manifest e service worker) e pede permissão de notificação por um toque da pessoa.
- O servidor guarda as inscrições de push fora do git e manda o aviso quando a detecção registra latido ou choro acima de um limite, com intervalo mínimo entre avisos para não virar spam.
- Chaves VAPID geradas no PC e guardadas fora do git; o repositório é público.
- O aviso abre a página no clipe do evento.
- Tudo configurável: ligar ou desligar, limiares, intervalo mínimo, horário de silêncio, se o plano decidir que precisa.

## Pontos que o plano precisa cobrir
- **iPhone:** web push só funciona com a página instalada na tela inicial (iOS 16.4 ou mais novo); a página precisa explicar isso e o passo a passo.
- **Tailscale Serve com HTTPS:** service worker e push exigem contexto seguro; a página é servida em `https://<maquina>.ts.net`, e o envio sai do PC para o serviço de push do navegador (Google, Apple, Mozilla). Conferir que o middleware `recusaTailscale` não bloqueia o service worker nem o manifest, e que nada passa a ser público.
- O que é "latir ou chorar muito" com o detector de som de hoje (nível e duração); detector de latido por modelo (YAMNet) fica como opção a avaliar, não obrigatória.
- Segurança: rota de inscrição só para quem passou pelo login da tailnet; nada de segredo no git.

## Impacto
Specs novas ou alteradas: `avisos` (nova), `pagina`, `servidor`. Áreas: `src/avisos/` (novo), `src/servidor/` (rotas de inscrição), `web/` (manifest, service worker, botão de ativar avisos), a ligação do evento em `src/deteccao/index.js` ou `agregador.js`, `config.json`, `config.local.example.json`, README, `package.json` (dependência de push, se usar). Não toca `src/deteccao/clipes.js` nem `test/deteccao-clipes.test.js` (ROCKY-16).
