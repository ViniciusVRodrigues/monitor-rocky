## ADDED Requirements

### Requirement: Aviso de latido ou choro
Quando os avisos estão ligados e a detecção registra som acima do limiar configurado pelo tempo configurado, o sistema SHALL enviar uma notificação web push a cada inscrição guardada, respeitando o intervalo mínimo entre avisos.

#### Scenario: Latido longo
- **WHEN** chega um evento de som que passa do limiar e da duração configurados, e o último aviso foi há mais que o intervalo mínimo
- **THEN** cada inscrição recebe uma notificação em pt-BR que abre a página no evento

#### Scenario: Dentro do intervalo mínimo
- **WHEN** chega outro evento antes de acabar o intervalo mínimo desde o último aviso
- **THEN** nenhum aviso novo é enviado

### Requirement: Inscrição só pela tailnet
As rotas de inscrever e cancelar avisos SHALL passar pelas mesmas regras de acesso das demais rotas (login da tailnet de fora, livre no próprio PC), e as chaves e inscrições SHALL ficar fora do git.

#### Scenario: Pedido de fora sem login
- **WHEN** chega um pedido de inscrição com Host da tailnet e sem `Tailscale-User-Login`
- **THEN** a resposta é 403 e nada é guardado

### Requirement: Inscrição expirada
O sistema SHALL apagar a inscrição quando o serviço de push responde que ela não existe mais (404 ou 410).

#### Scenario: Celular desinstalou a página
- **WHEN** o envio para uma inscrição recebe 410
- **THEN** a inscrição é apagada e os outros envios seguem
