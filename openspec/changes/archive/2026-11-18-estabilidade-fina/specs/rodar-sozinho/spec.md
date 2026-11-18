## ADDED Requirements

### Requirement: Parar a tarefa derruba tudo
Ao parar a tarefa agendada ou remover o serviço, o sistema SHALL encerrar o vigia, o monitor e os processos ffmpeg filhos, sem deixar processo órfão.

#### Scenario: Remover o serviço
- **WHEN** a pessoa roda `npm run remover-servico` com o monitor rodando
- **THEN** não sobra processo node nem ffmpeg do monitor-rocky

### Requirement: Node na prioridade configurada
O processo node do monitor SHALL rodar na prioridade dada por `tarefaPrioridade`.

#### Scenario: Prioridade acima do normal
- **WHEN** `tarefaPrioridade` pede acima do normal e a tarefa sobe no logon
- **THEN** o processo node aparece com prioridade acima do normal

#### Scenario: Parar a tarefa pelo Agendador
- **WHEN** a tarefa é encerrada (`schtasks /End`, ou "Finalizar" no Agendador)
- **THEN** o vigia percebe que o processo pai (wscript da tarefa) saiu e encerra a si mesmo, o monitor e o ffmpeg
