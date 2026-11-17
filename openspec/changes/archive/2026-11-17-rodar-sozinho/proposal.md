Issue: https://github.com/ViniciusVRodrigues/monitor-rocky/issues/6

## Why

O monitor precisa ficar sempre ligado sem a pessoa lembrar: subir com o Windows, voltar se cair e avisar quando a câmera ou o microfone somem (ROCKY-5).

## What Changes

- `npm run instalar-servico` / `npm run remover-servico`: tarefa agendada do Windows no logon do usuário (não serviço: DirectShow só enxerga a câmera na sessão interativa do usuário; serviços rodam na sessão 0), sem janela.
- Vigia (`src/vigia.js`): sobe o `npm start` (`src/captura.js`), reinicia se cair com espera crescente e grava log em arquivo com rotação (pasta, tamanho e quantidade configuráveis).
- Saúde (`src/saude.js`): detecta câmera ou microfone sumidos (ffmpeg falhando seguidas vezes ou dispositivo fora da lista do DirectShow), grava `gravacoes/saude.json`, mostra toast do Windows e chama o gancho `aoAlerta` (para o ROCKY-6 mandar ao celular).
- Chaves novas em `config.json`, documentadas no README.

## Capabilities

### New Capabilities
- `rodar-sozinho`: início automático, vigia do processo, log com rotação e alerta de dispositivo sumido.

### Modified Capabilities

## Impact

Código novo em `src/` e `scripts/`; não muda o ponto de entrada `npm start`. O ROCKY-3 pode ler `gravacoes/saude.json`; o ROCKY-6 liga em `aoAlerta`.
