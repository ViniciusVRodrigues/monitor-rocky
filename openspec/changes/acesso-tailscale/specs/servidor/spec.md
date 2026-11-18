## ADDED Requirements

### Requirement: Acesso de fora só pela tailnet
O acesso de fora SHALL passar só pelo Tailscale Serve, que encaminha para `127.0.0.1`; o sistema SHALL NOT usar Tailscale Funnel nem abrir porta, e o script de acesso SHALL recusar ligar quando houver Funnel ativo.

#### Scenario: Funnel ligado
- **WHEN** a pessoa roda o script de ligar e o Funnel está ativo na máquina
- **THEN** o script para com erro em pt-BR e não liga o Serve

### Requirement: Logins permitidos
Quando `tailscaleLoginsPermitidos` tem itens, o servidor SHALL responder 403 a todo pedido cujo cabeçalho `Tailscale-User-Login` não esteja na lista; com a lista vazia ou ausente, SHALL aceitar qualquer pessoa da tailnet.

#### Scenario: Login fora da lista
- **WHEN** chega um pedido com `Tailscale-User-Login: estranho@example.com` e ele não está na lista
- **THEN** a resposta é 403 e nenhuma rota roda

#### Scenario: Lista vazia
- **WHEN** `tailscaleLoginsPermitidos` está vazia e chega pelo Serve um pedido com `Tailscale-User-Login: qualquer@exemplo.com`
- **THEN** o pedido segue para as rotas

### Requirement: Identidade obrigatória de fora
Todo pedido de fora (Host diferente de `127.0.0.1:<porta>`/`localhost:<porta>`, ou com `X-Forwarded-For`, ou com `Tailscale-User-Login`) SHALL trazer `Tailscale-User-Login` não vazio; sem ele, o servidor SHALL responder 403, mesmo com a lista vazia. O pedido local, sem esses sinais, SHALL seguir sem identidade.

#### Scenario: Host da tailnet sem identidade
- **WHEN** chega um pedido com Host da tailnet e sem `Tailscale-User-Login`, com a lista vazia
- **THEN** a resposta é 403 em pt-BR e nenhuma rota roda

#### Scenario: Página local
- **WHEN** a página é aberta no próprio PC por `http://127.0.0.1:<porta>/`, sem cabeçalho do Tailscale
- **THEN** ela abre como antes, com a lista de logins vazia ou preenchida
