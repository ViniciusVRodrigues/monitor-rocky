import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tamanhoAnalise, fracaoMudada, criarDetectorMovimento } from '../src/deteccao/movimento.js';

const L = 32, A = 18;

function quadro(fn) {
  const b = Buffer.alloc(L * A);
  for (let y = 0; y < A; y++) for (let x = 0; x < L; x++) b[y * L + x] = fn(x, y);
  return b;
}
const fundo = () => quadro(() => 100);
const retangulo = (x0) => quadro((x, y) => (x >= x0 && x < x0 + 8 && y >= 4 && y < 12 ? 220 : 100));

function rodar(quadros, { cortar = null, ...opcoes } = {}) {
  const ev = [];
  const d = criarDetectorMovimento({
    largura: L, altura: A, limiarPixel: 25, areaMinima: 0.05, quadrosSeguidos: 1,
    aoAtividade: (t, f) => ev.push([t, f]), ...opcoes,
  });
  const tudo = Buffer.concat(quadros);
  if (!cortar) {
    d.processar(tudo, 1000);
  } else {
    let pos = 0;
    while (pos < tudo.length) {
      const n = Math.min(cortar(), tudo.length - pos);
      pos += n;
      d.processar(tudo.subarray(pos - n, pos), 1000 + pos);
    }
  }
  return { ev, d };
}

test('tamanhoAnalise mantém a proporção com altura par', () => {
  assert.deepEqual(tamanhoAnalise('1280x720', 160), { largura: 160, altura: 90 });
  assert.deepEqual(tamanhoAnalise('640x480', 160), { largura: 160, altura: 120 });
  const t = tamanhoAnalise('1920x1080', 100);
  assert.equal(t.altura % 2, 0);
  assert.equal(t.largura % 2, 0);
  assert.equal(t.altura, 56);
});

test('fracaoMudada conta pixels acima do limiar', () => {
  assert.equal(fracaoMudada(Buffer.from([0, 0, 0, 0]), Buffer.from([30, 25, 0, 100]), 25), 0.5);
});

test('quadros iguais ou com ruído pequeno não disparam', () => {
  assert.equal(rodar([fundo(), fundo(), fundo()]).ev.length, 0);
  const ruido = (s) => quadro((x, y) => 100 + (((x * 7 + y * 13 + s * 5) % 11) - 5));
  assert.equal(rodar([ruido(0), ruido(1), ruido(2)]).ev.length, 0);
});

test('retângulo que se move dispara', () => {
  const { ev } = rodar([retangulo(2), retangulo(12), retangulo(22)]);
  assert.equal(ev.length, 2);
  assert.ok(ev[0][1] > 0.05 && ev[0][1] <= 1);
});

test('quadrosSeguidos = 2 exige dois quadros mudados seguidos', () => {
  // quadros: fundo, ret (mudou), ret (igual), fundo (mudou): nunca dois seguidos
  const um = rodar([fundo(), retangulo(2), retangulo(2), fundo()], { quadrosSeguidos: 2 });
  assert.equal(um.ev.length, 0);
  // mudou, mudou, mudou: ativo a partir do segundo quadro mudado
  const dois = rodar([fundo(), retangulo(2), retangulo(12), retangulo(22)], { quadrosSeguidos: 2 });
  assert.equal(dois.ev.length, 2);
});

test('quadros fatiados em pedaços aleatórios dão o mesmo resultado', () => {
  const qs = [fundo(), retangulo(2), retangulo(12), retangulo(22), fundo()];
  const ref = rodar(qs).ev.map((e) => e[1]);
  let s = 7;
  const alea = () => { s = (s * 1103515245 + 12345) % 2147483648; return 1 + (s % 200); };
  const fat = rodar(qs, { cortar: alea }).ev.map((e) => e[1]);
  assert.deepEqual(fat, ref);
});

test('reiniciar descarta quadro anterior e resto', () => {
  const ev = [];
  const d = criarDetectorMovimento({
    largura: L, altura: A, limiarPixel: 25, areaMinima: 0.05, quadrosSeguidos: 1,
    aoAtividade: (t, f) => ev.push(f),
  });
  d.processar(fundo(), 1);
  d.processar(retangulo(2).subarray(0, 100), 2); // resto parcial
  d.reiniciar();
  d.processar(retangulo(2), 3); // primeiro quadro após reiniciar: sem comparação
  assert.equal(ev.length, 0);
  d.processar(retangulo(12), 4);
  assert.equal(ev.length, 1);
});
