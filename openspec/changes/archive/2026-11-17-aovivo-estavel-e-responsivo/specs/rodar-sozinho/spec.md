## ADDED Requirements

### Requirement: Prioridade da tarefa e da captura
A tarefa agendada SHALL rodar com a prioridade da config (`tarefaPrioridade`, padrão normal), e o ffmpeg de captura SHALL subir com a prioridade da config (`ffmpegPrioridade`, padrão acima do normal), para que outra carga na máquina não deixe a captura sem CPU.

#### Scenario: Máquina carregada
- **WHEN** outros programas usam quase toda a CPU
- **THEN** o ffmpeg de captura continua consumindo a câmera em tempo real e o log não mostra "frame dropped"

#### Scenario: Tarefa instalada
- **WHEN** a pessoa roda `npm run instalar-servico`
- **THEN** o XML da tarefa traz a prioridade da config
