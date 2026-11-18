## 1. Plano
- [x] 1.1 Pesquisar o Tailscale Serve atual no Windows (HTTPS, cabeçalhos de identidade, compartilhar com convidado) e fechar o plano com a skill planejar. Feito: Serve põe `Tailscale-User-Login` (apaga o do cliente; ausente em Funnel e em máquina com tag), mantém o Host e põe `X-Forwarded-For` (relatos; conferir na 4.1); convidado por compartilhamento da máquina. Fontes: https://tailscale.com/kb/1312/serve, https://tailscale.com/docs/reference/tailscale-cli/serve.md

## 2. Servidor
- [x] 2.1 Middleware de logins permitidos pelo cabeçalho `Tailscale-User-Login`, em `src/servidor/seguranca.js` (`recusaTailscale`), ligado em `criarServidor` antes das rotas. Pedido de fora (Host fora de 127.0.0.1/localhost:<porta>, ou com `X-Forwarded-For`, ou com o cabeçalho) sem identidade dá 403 sempre; lista vazia libera qualquer pessoa da tailnet; lista com itens exige o login nela. Página local segue sem login. Testes em `test/servidor-seguranca.test.js`.
- [x] 2.2 Chave nova validada e documentada no README e no `config.local.example.json`.

## 3. Tailscale
- [x] 3.1 Script `npm run tailscale -- ligar|desligar|estado` que chama `tailscale serve` (nunca `funnel`) e recusa se detectar Funnel ligado.
- [x] 3.2 Passo a passo no README para a pessoa: instalar, entrar, aprovar a máquina, convidar o convidado, abrir no celular.

## 4. Entrega
- [ ] 4.1 Página aberta pelo celular fora da rede de casa, com ao vivo e som; anotar o atraso e conferir os cabeçalhos reais (Host da tailnet e `X-Forwarded-For`) e o formato do `tailscale serve status --json` (`AllowFunnel`).
- [ ] 4.2 Conferido que nada está público (sem Funnel, nenhuma porta aberta).
