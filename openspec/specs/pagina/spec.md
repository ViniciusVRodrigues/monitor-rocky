# pagina Specification

## Purpose
TBD - created by archiving change servidor-pagina. Update Purpose after archive.
## Requirements
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

### Requirement: Som ao vivo ligado ao abrir
A página SHALL tentar tocar o som ao vivo ao abrir quando `somAoAbrir` for verdadeiro, mas a escolha salva no aparelho (`localStorage` `rocky.som`) vale mais. O botão grande SHALL alternar entre "Silenciar" e "Ativar som" e salvar a escolha. Se o navegador bloquear o som, a página SHALL mostrar "Toque para ouvir o Rocky" e começar no primeiro toque ou tecla em qualquer lugar. No modo `mp3` SHALL usar um `<audio>` com Media Session. O "Ouvir no PC" SHALL começar desligado.

#### Scenario: Autoplay bloqueado
- **WHEN** a página abre com o som ligado e o navegador bloqueia o áudio
- **THEN** aparece "Toque para ouvir o Rocky" e, no primeiro toque, o som começa e o aviso some

#### Scenario: Escolha lembrada
- **WHEN** a pessoa toca "Silenciar" e recarrega a página
- **THEN** a página abre silenciada, com o botão "Ativar som"

#### Scenario: Atraso no PC
- **WHEN** o modo é `pcm` e o som está ligado
- **THEN** o atraso fica abaixo de `ouvirAtrasoMaxMs` mais a folga

### Requirement: Nível do som
A página SHALL mostrar, perto do chip e do vídeo, uma barra de nível do microfone vinda do evento `nivel` do SSE, sem tocar som. A barra é `aria-hidden` e vem com um rótulo visível discreto. Em `parado`, ou sem nível há mais de 2 s, ela SHALL mostrar "sem som".

#### Scenario: Só som
- **WHEN** o estado é `so-som` e o microfone capta barulho
- **THEN** a barra se mexe

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

### Requirement: Som do site com ganho configurável
O som ao vivo da página SHALL passar por um ganho em dB vindo da config (`ouvirGanhoDb`), seguido de um compressor que evita estouro, no modo PCM e no modo MP3.

#### Scenario: Sala quieta
- **WHEN** o microfone capta um som baixo, como um coçar ou um choro
- **THEN** a página toca esse som com o ganho da config aplicado, audível sem aumentar o volume do sistema

#### Scenario: Pico alto
- **WHEN** chega um som forte, como um latido perto do microfone
- **THEN** o compressor limita a saída e o som não distorce

### Requirement: Voltar ao ao vivo
Ao clicar em "Voltar ao ao vivo" depois de tocar uma gravação, a página SHALL recriar o player do ao vivo e mostrar o selo AO VIVO, sem tela de erro presa.

#### Scenario: Volta depois de uma gravação
- **WHEN** a pessoa toca um trecho da linha do tempo e clica em "Voltar ao ao vivo"
- **THEN** o ao vivo volta a tocar em poucos segundos, com o selo e sem os controles da gravação

### Requirement: Player estável
A página SHALL recriar o player do ao vivo só quando o estado da captura muda (gravando, só som, parado) ou quando a pessoa pede, e não a cada evento ou reconexão do SSE.

#### Scenario: SSE reconecta
- **WHEN** o SSE reconecta ou manda o mesmo estado de novo
- **THEN** o vídeo continua tocando sem recarregar

#### Scenario: Navegador com HLS nativo e MSE
- **WHEN** o navegador tem MSE (hls.js suportado) e também diz tocar HLS nativo (Chrome 14x+)
- **THEN** a página usa o hls.js; o HLS nativo fica só para quem não tem MSE (Safari no iPhone)

### Requirement: Vídeo ocupa a tela
O vídeo do ao vivo SHALL ocupar a maior área possível mantendo a proporção, em 390, 768, 1280 e 1920 px de largura, sem rolagem horizontal, com os controles e a linha do tempo acessíveis.

#### Scenario: Monitor largo
- **WHEN** a página abre em 1920 px
- **THEN** o vídeo usa a largura disponível ao lado ou acima do resto, sem ficar numa coluna estreita

### Requirement: Barra de nível visível
A barra de nível SHALL mexer com o som de um quarto quieto e com fala próxima, com piso e escala configuráveis.

#### Scenario: Pessoa fala perto do microfone
- **WHEN** alguém fala perto do microfone
- **THEN** a barra sobe visivelmente e volta quando o som para

