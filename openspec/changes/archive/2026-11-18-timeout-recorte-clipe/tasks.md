## 1. Timeout
- [x] 1.1 Teste: ffmpeg falso que nunca termina; o recorte é morto depois de `clipeTimeoutSegundos` e o próximo clipe da fila sai.
- [x] 1.2 Implementar o tempo limite (padrão sugerido: 120 s) com a chave em `config.json`, validada e documentada no README.

## 2. Teste intermitente
- [x] 2.1 Rodar `npm test` pelo menos 10 vezes, achar o teste que falha e a causa (tempo, porta, pasta compartilhada, ordem).
- [x] 2.2 Corrigir a causa (sem aumentar espera às cegas) e confirmar com 10 rodadas verdes.
