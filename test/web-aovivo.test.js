import { test as testeNode, mock } from 'node:test';
import assert from 'node:assert/strict';
import { criarPlayer } from '../web/js/aovivo.js';

// Os relógios do player re-tentam para sempre: nos testes eles são falsos, e sempre zerados no fim.
function test(nome, fn) {
  testeNode(nome, () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    try { return fn(); } finally { mock.timers.reset(); }
  });
}

function el(extra = {}) {
  return { hidden: false, textContent: '', addEventListener() {}, ...extra };
}

function montar({ conectarMs = 1000, tocarEvento = false } = {}) {
  const video = {
    hidden: false, muted: false, controls: true, src: '', onplaying: null, onerror: null, onended: null,
    canPlayType: () => 'maybe', load() {}, removeAttribute(a) { if (a === 'src') this.src = ''; },
    play: () => Promise.resolve(),
  };
  const nos = {
    tela: el({ hidden: true }), telaTexto: el(), telaBotao: el({ hidden: true }), medidor: el({ hidden: true }),
    selo: el({ hidden: true }), faixa: el({ hidden: true }), faixaTexto: el(),
  };
  const player = criarPlayer({ video, ...nos, conectarMs });
  return { video, nos, player, tocarEvento };
}

test('voltar ao ao vivo depois de uma gravação: player limpo, ao vivo mudo, tela de conexão, sem faixa', () => {
  const { video, nos, player } = montar();
  player.aplicar('gravando', {});
  player.tocar({ urls: ['/a.mp4', '/b.mp4'], soAudio: true, rotulo: '13:52' });
  assert.equal(player.modo, 'gravacao');
  assert.equal(nos.faixa.hidden, false);
  assert.equal(video.muted, false);

  player.voltarAoVivo();
  assert.equal(player.modo, 'vivo');
  assert.equal(nos.faixa.hidden, true);
  assert.equal(video.muted, true);
  assert.equal(video.controls, false);
  assert.equal(video.onended, null);
  assert.match(video.src, /\/aovivo\/index\.m3u8\?t=/);
  assert.equal(nos.tela.hidden, false);
  assert.match(nos.telaTexto.textContent, /Conectando/);
  assert.equal(nos.medidor.hidden, true);
  assert.equal(nos.telaBotao.hidden, true);

  video.onplaying();
  assert.equal(nos.tela.hidden, true);
  assert.equal(nos.selo.hidden, false);
});

test('voltar ao ao vivo com o monitor em só-som mostra a tela do estado, não o vídeo', () => {
  const { video, nos, player } = montar();
  player.aplicar('gravando', {});
  player.tocar({ urls: ['/a.mp4'], soAudio: false, rotulo: '13:52' });
  player.aplicar('so-som', { camera: () => {} }); // muda por baixo da gravação
  player.voltarAoVivo();
  assert.equal(video.src, '');
  assert.match(nos.telaTexto.textContent, /Câmera liberada/);
  assert.equal(nos.faixa.hidden, true);
});

test('conectando que não toca no tempo vira erro com "Tentar agora" (não fica preso)', () => {
  {
    const { video, nos, player } = montar({ conectarMs: 5000 });
    player.aplicar('gravando', {});
    assert.match(nos.telaTexto.textContent, /Conectando/);
    mock.timers.tick(4999);
    assert.match(nos.telaTexto.textContent, /Conectando/);
    mock.timers.tick(2);
    assert.match(nos.telaTexto.textContent, /Não consegui abrir o ao vivo/);
    assert.equal(nos.telaBotao.hidden, false);
    // tocar a tempo cancela o relógio
    player.voltarAoVivo();
    video.onplaying();
    mock.timers.tick(60000);
    assert.equal(nos.tela.hidden, true);
  }
});

test('gancho aoGravacao/aoVivo avisa a página (o som do site não toca por cima da gravação)', () => {
  const eventos = [];
  const video = { hidden: false, canPlayType: () => 'maybe', load() {}, removeAttribute() {}, play: () => Promise.resolve() };
  const nos = { tela: el(), telaTexto: el(), telaBotao: el(), medidor: el(), selo: el(), faixa: el(), faixaTexto: el() };
  const player = criarPlayer({ video, ...nos, conectarMs: 1000, aoModo: (m) => eventos.push(m) });
  player.aplicar('gravando', {});
  player.tocar({ urls: ['/a.mp4'], soAudio: false, rotulo: 'x' });
  player.tocar({ urls: ['/b.mp4'], soAudio: false, rotulo: 'y' });
  player.voltarAoVivo();
  assert.deepEqual(eventos, ['gravacao', 'vivo']);
});
