## ADDED Requirements

### Requirement: Aviso de latido ou choro
Quando os avisos estão ligados e um evento de som ainda aberto (som acima de `somLimiarDb`, com pausas menores que `eventoJuntarSegundos`) chega a `avisoSomSegundos`, o sistema SHALL enviar na hora, sem esperar o clipe, uma notificação web push a cada inscrição guardada, no máximo uma por evento, respeitando o intervalo mínimo entre avisos e o horário de silêncio. Decisão da pessoa (2026-11-18): aviso na hora; o toque abre a página no ao vivo.

#### Scenario: Latido longo
- **WHEN** o evento de som aberto chega a 20 s e o último aviso foi há mais que o intervalo mínimo
- **THEN** cada inscrição recebe uma notificação em pt-BR ("Barulho há 20 s seguidos (HH:MM). Toque para ver.") que, tocada, abre a página no ao vivo

#### Scenario: Evento longo avisa uma vez
- **WHEN** o mesmo evento de som continua depois do aviso
- **THEN** nenhum aviso novo sai por esse evento

#### Scenario: Horário de silêncio
- **WHEN** `avisoSilencioInicio` e `avisoSilencioFim` estão preenchidos e o som longo acontece dentro desse horário (que pode cruzar a meia-noite)
- **THEN** nenhum aviso é enviado

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

### Requirement: Ativar avisos na página
A página SHALL ser instalável (manifest e service worker) e ter o bloco "Avisos no celular" com os estados indisponível aqui, sem suporte, falta instalar (iPhone/iPad fora da Tela de Início, com o passo a passo), desligados no PC, bloqueado (com como desbloquear), pronto, pedindo, ativo (com aviso de teste e desativar) e erro. A permissão SHALL ser pedida só por toque da pessoa.

#### Scenario: iPhone no Safari sem instalar
- **WHEN** a página abre no Safari do iPhone fora da Tela de Início
- **THEN** o bloco mostra "Falta instalar" e os quatro passos para adicionar à Tela de Início

#### Scenario: Toque no aviso
- **WHEN** a pessoa toca na notificação
- **THEN** a página abre no ao vivo (ou a aba já aberta ganha o foco)

#### Scenario: Chaves trocadas no PC
- **WHEN** a página abre com permissão concedida e a inscrição do aparelho usa uma chave diferente da do servidor
- **THEN** a página refaz a inscrição com a chave nova e a reenvia ao servidor
