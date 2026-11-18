## 1. Plano
- [ ] 1.1 Pesquisar o Tailscale Serve atual no Windows (HTTPS, cabeçalhos de identidade, compartilhar com convidado) e fechar o plano com a skill planejar.

## 2. Servidor
- [ ] 2.1 Middleware de logins permitidos pelo cabeçalho `Tailscale-User-Login`, ligado só quando a chave tem itens; só confia no cabeçalho em pedido que chega pelo Serve (127.0.0.1). Testes: login fora da lista dá 403, lista vazia libera, sem cabeçalho dá 403 quando a lista tem itens.
- [ ] 2.2 Chave nova validada e documentada no README e no `config.local.example.json`.

## 3. Tailscale
- [ ] 3.1 Script `npm run tailscale -- ligar|desligar|estado` que chama `tailscale serve` (nunca `funnel`) e recusa se detectar Funnel ligado.
- [ ] 3.2 Passo a passo no README para a pessoa: instalar, entrar, aprovar a máquina, convidar o convidado, abrir no celular.

## 4. Entrega
- [ ] 4.1 Página aberta pelo celular fora da rede de casa, com ao vivo e som; anotar o atraso.
- [ ] 4.2 Conferido que nada está público (sem Funnel, nenhuma porta aberta).
