# Acesso remoto pelo Tailscale (ROCKY-4)

Issue: https://github.com/ViniciusVRodrigues/monitor-rocky/issues/18

## Por quê
O app roda inteiro no PC, mas só é visto de lá. A pessoa quer ver o Rocky de fora (celular e PC do trabalho) e dar acesso a um convidado. Decisão de 2026-11-17: Tailscale, não Cloudflare (os termos da Cloudflare restringem vídeo pelo túnel no plano grátis). Nada público na internet.

## O que muda
- O servidor segue só em `127.0.0.1`; o Tailscale Serve publica a porta com HTTPS só dentro da tailnet. Nunca Funnel, nunca porta aberta no roteador ou no firewall.
- O host da máquina na tailnet (`<maquina>.<tailnet>.ts.net`) entra em `hostsPermitidos` pelo `config.local.json` (não vai ao git).
- Opcional e configurável: lista de logins permitidos lida do cabeçalho de identidade do Tailscale Serve (`Tailscale-User-Login`), pelo ponto de middleware `antes`. Lista vazia = qualquer pessoa da tailnet.
- Script para ligar, desligar e ver o estado do Serve, documentado no README, com o passo a passo da pessoa (instalar o Tailscale no PC e no celular, entrar na conta, convidar o convidado).
- Teste no celular real: tela apagada, atraso do ao vivo, Safari/iOS se houver.

## Impacto
Spec `servidor`. Áreas: `src/servidor/seguranca.js`, `src/servidor/app.js` (só a ligação do middleware), `src/config.js` (só a validação da chave nova), `scripts/` (script novo do Tailscale), `package.json` (só a linha do script novo), `config.local.example.json`, seção nova do `README` sobre acesso de fora.
