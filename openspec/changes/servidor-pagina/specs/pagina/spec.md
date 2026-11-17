## ADDED Requirements

### Requirement: Estado sempre visível
A página SHALL mostrar o estado da captura num chip com texto ("● Gravando", "Só som · câmera livre", "Parado", "Reiniciando a captura…", "Estado desconhecido"), atualizado pelo SSE, sem depender só da cor.

#### Scenario: Troca vinda de outro aparelho
- **WHEN** o estado muda por outro cliente
- **THEN** o chip e a área do vídeo mudam sem recarregar a página

### Requirement: Ao vivo
A página SHALL tocar o HLS ao vivo (hls.js, ou nativo no Safari), mudo, e SHALL recriar o player a cada troca de estado; em `so-som` e `parado` SHALL mostrar a tela do estado no lugar do vídeo.

#### Scenario: Câmera liberada
- **WHEN** o estado é `so-som`
- **THEN** a área do vídeo mostra "Câmera liberada para você usar. O som continua gravando." e o botão "Religar câmera"

### Requirement: Ouvir
O botão "Ouvir" SHALL tocar o som ao vivo com `aria-pressed`, nos estados "Conectando…", "Ouvindo · parar", "Sem som. Reconectando…" e "Não deu para ouvir. Tentar de novo"; no modo `mp3` SHALL usar um `<audio>` iniciado no clique e Media Session.

#### Scenario: Ouvir no PC
- **WHEN** o modo é `pcm` e a pessoa toca "Ouvir"
- **THEN** o som toca com atraso menor que `ouvirAtrasoMaxMs` mais a folga

### Requirement: Controles com retorno
Cada controle SHALL mostrar "Aplicando…" (com `aria-busy`, demais controles desabilitados) em até 100 ms, SHALL mudar o chip só com a confirmação do servidor e SHALL mostrar erro com "Tentar de novo" se falhar ou passar de `controleTempoLimiteSegundos`. "Parar" SHALL pedir confirmação no próprio lugar, que volta sozinha em 6 s e cancela com Esc.

#### Scenario: Parar
- **WHEN** a pessoa toca "Parar"
- **THEN** aparece "Parar a gravação? [Sim, parar] [Cancelar]" e nada muda até "Sim, parar"

### Requirement: Linha do tempo do dia
A página SHALL mostrar o dia (navegação entre dias), a régua de 24 h, as horas sem gravação recolhidas, blocos contínuos de trechos e cartões de eventos com miniatura e intensidade em texto (fraca/média/forte); tocar num bloco ou evento SHALL abrir a gravação no player ("Gravação · HH:MM · Voltar ao ao vivo"), e trechos só de áudio SHALL tocar como áudio.

#### Scenario: Evento novo enquanto vê hoje
- **WHEN** chega um evento pelo SSE
- **THEN** aparece a pílula "1 evento novo · ver" (aria-live), sem mexer na rolagem

#### Scenario: Dia vazio
- **WHEN** o dia não tem trechos nem eventos
- **THEN** aparece "Nada gravado neste dia. Os trechos ficam guardados por 4 horas." (com o valor de `bufferHoras`)

### Requirement: Responsiva e acessível
A página SHALL funcionar sem rolagem horizontal em 360, 390, 768 e 1280 px e com zoom de 200%, com alvos de pelo menos 48 px, foco visível, navegação só por teclado, contraste 4.5:1 (texto) e 3:1 (controles), textos em pt-BR e respeito a `prefers-reduced-motion`.

#### Scenario: Celular
- **WHEN** a largura é 390 px
- **THEN** cabeçalho, vídeo, Ouvir, controles e a régua do dia cabem nos primeiros 720 px de altura
