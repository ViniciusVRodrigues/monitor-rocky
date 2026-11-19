# Desenho: avisos por web push (ROCKY-6)

## Visão geral
```
detecção de som ──(regra: som longo, intervalo, silêncio)──► avisos.enviarTodos(payload)
                                                              │ web-push (VAPID, aes128gcm)
                                                              ▼
                                  serviço de push do navegador (Google / Apple / Mozilla / Microsoft)
                                                              ▼
                                  celular: sw.js → showNotification → toque → abre a página (tailnet)
```
O envio sai do PC para a internet (HTTPS de saída), nunca entra nada de fora: o servidor segue só em 127.0.0.1 e o acesso à página segue só pelo Tailscale Serve. O payload é cifrado de ponta a ponta (RFC 8291); o serviço de push vê só o tamanho e o endpoint.

## Decisões técnicas
- **Biblioteca `web-push` fixada em `3.6.7`** (sem `^`). É a implementação de referência do VAPID (RFC 8292) e da cifra (RFC 8291). A 4.0.0 saiu em 2026-11-06, com menos de duas semanas: reavaliar depois. Implementar a cifra à mão foi descartado (erro de interoperabilidade só aparece no aparelho real).
- **Chaves e inscrições em arquivos próprios**, em `<pasta>/<avisosPasta>/vapid.json` e `inscricoes.json` (padrão `gravacoes/avisos/`, fora do git pelo `.gitignore` de `gravacoes/`). As chaves VAPID são geradas na primeira subida com avisos ligados. Nenhum código grava no `config.local.json` (a pessoa edita à mão). Gravação atômica (arquivo `.tmp` + `rename`). Nenhuma limpeza (`limparClipes`, `limparPorEspaco`, `apagarHora`, limpeza de trechos) varre essa pasta, e `/arquivos/` não a serve (só `trechos`, `clipes` e `guardados`).
- **`sub` do VAPID**: chave `avisosContato`, padrão a URL pública do repositório (`https://github.com/ViniciusVRodrigues/monitor-rocky`). A Apple recusa (`BadJwtToken`) `sub` que não seja `mailto:` ou `https:` bem formado; um e-mail só entra no `config.local.json`, por escolha da pessoa (o JWT vai a Google, Apple e Mozilla).
- **Lista de hosts de push** (`avisosHostsPush`): o endpoint vem do navegador, então é dado não confiável. Aceito só `https:` em host igual ou subdomínio de `fcm.googleapis.com`, `web.push.apple.com`, `push.services.mozilla.com`, `notify.windows.com` (evita SSRF: o PC não faz POST para endereço escolhido por quem inscreve). Conferido ao inscrever (400) e de novo ao enviar.
- **Opções de envio**: `urgency: 'high'` (o Doze do Android não segura), `TTL` = `avisoValidadeSegundos` (padrão 600: aviso velho não serve), `topic: 'rocky-som'` (o serviço junta avisos repetidos pendentes), timeout `avisoEnvioTimeoutSegundos`.
- **Inscrição expirada**: 404 ou 410 do serviço de push apaga a inscrição; outros erros só vão ao log, e os demais envios seguem (`Promise.allSettled`).
- **Sincronização na página**: a cada carga com permissão concedida, a página lê `getSubscription()`; se a chave da inscrição difere de `/api/avisos/chave` (chaves regeneradas), faz `unsubscribe()` e `subscribe()` de novo; e sempre reenvia a inscrição (upsert por endpoint). Assim o servidor recupera inscrição apagada num 410 ou perdida com o arquivo.
- **Service worker**: todo `push` chama `showNotification` dentro de `event.waitUntil` (o Safari cancela a inscrição de quem recebe push sem mostrar notificação). O payload traz título, corpo, URL e tag; o handler não faz `fetch` (com o Tailscale desligado o `/api` não responde). Ícone e badge ficam em cache no `install` do service worker, para aparecer mesmo fora da tailnet; se o cache faltar, a notificação sai sem ícone.

## Contrato
### Config (`config.json`, documentadas no README)
| chave | padrão | |
|---|---|---|
| `avisos` | `true` | liga os avisos (sem inscrição, nada é enviado) |
| `avisosPasta` | `"avisos"` | subpasta de `pasta` com chaves e inscrições (não pode ser `trechos`, `clipes`, `eventos`, `aovivo` nem `guardadosPasta`) |
| `avisoSomSegundos` | 20 | som (com pausas menores que `eventoJuntarSegundos`) por esse tempo dispara o aviso |
| `avisoIntervaloMinutos` | 10 | mínimo entre dois avisos |
| `avisoSilencioInicio` / `avisoSilencioFim` | `""` | horário sem avisos (`"HH:MM"`; vazios = sem silêncio; pode cruzar a meia-noite) |
| `avisoValidadeSegundos` | 600 | TTL no serviço de push |
| `avisoEnvioTimeoutSegundos` | 15 | tempo máximo de cada envio |
| `avisosMaxInscricoes` | 10 | inscrições guardadas (passou disso: a mais antiga sai) |
| `avisosContato` | URL do repositório | `sub` do VAPID (`https:` ou `mailto:`) |
| `avisosHostsPush` | os quatro acima | hosts aceitos no endpoint |

`/api/config` passa a trazer `avisos`, `avisoSomSegundos`, `avisoIntervaloMinutos`, `avisoSilencioInicio`, `avisoSilencioFim`.

### Rotas (todas passam por Host, `recusaTailscale` e `antes`, como as demais)
- `GET /api/avisos/chave` → `200 {"chave":"<VAPID pública, base64url>"}`; `404` com avisos desligados.
- `POST /api/avisos/inscrever` corpo `{"endpoint":"https://…","keys":{"p256dh":"…","auth":"…"}}` (o `toJSON()` da inscrição; até 4 KB) → `200 {"ok":true}`. `400` corpo ou chaves inválidos ou endpoint fora da lista; `403` sem `controlePermitido`; `404` avisos desligados.
- `POST /api/avisos/cancelar` corpo `{"endpoint":"…"}` → `200 {"ok":true}` (idempotente).
- `POST /api/avisos/teste` corpo `{"endpoint":"…"}` → envia um aviso de teste só a essa inscrição; `200 {"ok":true}` ou `404` se não está inscrita, `502` se o serviço de push recusou.
- Os POST usam `controlePermitido` (JSON, `X-Rocky: 1`, `Sec-Fetch-Site` e `Origin` do mesmo site).
- Estáticos novos: `/sw.js`, `/manifest.webmanifest`, `/img/icone-192.png`, `/img/icone-512.png`, `/img/badge-96.png` (o `resolverEstatico` já aceita; `/sw.js` vai com `Cache-Control: no-cache`).

### Payload (JSON cifrado)
`{"titulo":"Rocky","corpo":"Latindo ou chorando há 20 s","url":"/?…","tag":"rocky-som"}`. O `sw.js` abre `url` (mesma origem) ou foca a aba já aberta.

### Inscrição guardada
`{"endpoint","keys":{"p256dh","auth"},"criada":"<ISO local>"}`; sem login, sem IP, sem user-agent.

## Gatilho (decisão da pessoa em 2026-11-18: na hora, toque abre o ao vivo)
- O agregador ganha `atual()` (cópia de `{inicio, fim}` do evento aberto, ou null). No `setInterval` de verificação da detecção (1 s), antes de `verificar`, se o evento de som aberto tem `fim - inicio >= avisoSomSegundos*1000` e ainda não avisou, a detecção emite `aoSomLongo({ inicio, duracaoMs })` uma vez por evento (marca pelo `inicio`).
- `src/avisos/regra.js` (pura): `criarRegra({ intervaloMs, silencioInicio, silencioFim })` → `permitir(agora: Date)`: falso dentro do silêncio (pode cruzar a meia-noite) ou antes de `intervaloMs` desde o último aviso permitido; verdadeiro marca o último. O último aviso fica só em memória (reiniciar o monitor zera, aceitável).
- `principal.js` liga `det.aoSomLongo` → `regra.permitir` → `avisos.enviarTodos(payload)`. Com zero inscrições não envia e não marca o intervalo.
- Payload: `{"titulo":"Rocky","corpo":"Barulho há 20 s seguidos (14:32). Toque para ver.","url":"/","tag":"rocky-som"}`; N é `avisoSomSegundos` arredondado, a hora é a do início do som. O texto diz "barulho" porque o detector mede nível de som, não reconhece latido.
- Atraso esperado: N s de som + até 1 s da verificação + a entrega do serviço de push.
- YAMNet (classificador de latido) foi avaliado e fica fora: exigiria um modelo de ML (TensorFlow) rodando no PC já carregado de CPU; o limiar de nível + duração resolve o pedido. Reabrir se houver falso aviso demais (TV, aspirador).

## Segurança e privacidade
- Nada passa a ser público: nenhuma porta nova, nenhum Funnel; `sw.js` e `manifest` atrás do mesmo `recusaTailscale` (o Serve põe `Tailscale-User-Login` em todo pedido de aparelho de pessoa, inclusive o do manifest e do service worker). Teste: Host da tailnet sem login → 403 nas rotas novas e nos estáticos novos; com login → 200.
- O aviso chega mesmo com o Tailscale desligado no celular (vem pelo serviço de push); abrir a página exige o Tailscale ligado.
- Texto do aviso sem dado sensível (só "latindo ou chorando há N s").
