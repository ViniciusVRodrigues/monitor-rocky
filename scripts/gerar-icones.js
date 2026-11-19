// Gera os ícones do Rocky (pegada branca sobre azul) em web/img/, sem dependência: desenha num buffer RGBA
// com supersampling e grava PNG com zlib + CRC32. Uso: node scripts/gerar-icones.js
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SAIDA = join(dirname(fileURLToPath(import.meta.url)), '..', 'web', 'img');
const AZUL = [0x1f, 0x5f, 0xbf];
const BRANCO = [255, 255, 255];

// Elipses da pegada em coordenadas 0..1: [cx, cy, rx, ry, giro em graus]. Fica dentro dos 80% centrais.
const PEGADA = [
  [0.5, 0.645, 0.2, 0.15, 0],
  [0.255, 0.47, 0.065, 0.095, -28],
  [0.395, 0.335, 0.072, 0.102, -9],
  [0.605, 0.335, 0.072, 0.102, 9],
  [0.745, 0.47, 0.065, 0.095, 28],
];

function dentroPegada(x, y) {
  for (const [cx, cy, rx, ry, g] of PEGADA) {
    const a = (g * Math.PI) / 180;
    const dx = x - cx;
    const dy = y - cy;
    const u = dx * Math.cos(a) + dy * Math.sin(a);
    const v = -dx * Math.sin(a) + dy * Math.cos(a);
    if ((u * u) / (rx * rx) + (v * v) / (ry * ry) <= 1) return true;
  }
  return false;
}

function dentroQuadrado(x, y, raio) {
  const cx = Math.min(Math.max(x, raio), 1 - raio);
  const cy = Math.min(Math.max(y, raio), 1 - raio);
  return (x - cx) ** 2 + (y - cy) ** 2 <= raio * raio;
}

/** fundo: 'arredondado' (cantos transparentes), 'cheio' (sem transparência) ou 'nenhum' (só a pegada). */
function desenhar(tam, fundo) {
  const SS = 4;
  const rgba = Buffer.alloc(tam * tam * 4);
  for (let py = 0; py < tam; py += 1) {
    for (let px = 0; px < tam; px += 1) {
      let r = 0; let g = 0; let b = 0; let a = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const x = (px + (sx + 0.5) / SS) / tam;
          const y = (py + (sy + 0.5) / SS) / tam;
          let cor = null;
          if (dentroPegada(x, y)) cor = BRANCO;
          else if (fundo === 'cheio' || (fundo === 'arredondado' && dentroQuadrado(x, y, 0.22))) cor = AZUL;
          if (cor) { r += cor[0]; g += cor[1]; b += cor[2]; a += 1; }
        }
      }
      const n = SS * SS;
      const i = (py * tam + px) * 4;
      // cor média só dos amostras opacos (alfa direto), para não escurecer a borda
      rgba[i] = a ? Math.round(r / a) : 0;
      rgba[i + 1] = a ? Math.round(g / a) : 0;
      rgba[i + 2] = a ? Math.round(b / a) : 0;
      rgba[i + 3] = Math.round((a / n) * 255);
    }
  }
  return rgba;
}

const TABELA = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = TABELA[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function bloco(tipo, dados) {
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
  const comp = Buffer.alloc(4); comp.writeUInt32BE(dados.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([comp, corpo, crc]);
}
function codificarPng(rgba, tam) {
  const cab = Buffer.alloc(13);
  cab.writeUInt32BE(tam, 0); cab.writeUInt32BE(tam, 4);
  cab[8] = 8; cab[9] = 6; // 8 bits, RGBA
  const linhas = Buffer.alloc((tam * 4 + 1) * tam);
  for (let y = 0; y < tam; y += 1) {
    linhas[y * (tam * 4 + 1)] = 0;
    rgba.copy(linhas, y * (tam * 4 + 1) + 1, y * tam * 4, (y + 1) * tam * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco('IHDR', cab), bloco('IDAT', deflateSync(linhas, { level: 9 })), bloco('IEND', Buffer.alloc(0)),
  ]);
}

const SAIDAS = [
  ['icone-192.png', 192, 'arredondado'],
  ['icone-512.png', 512, 'arredondado'],
  ['icone-512-maskable.png', 512, 'cheio'],
  ['icone-180.png', 180, 'cheio'],
  ['badge-96.png', 96, 'nenhum'],
];
mkdirSync(SAIDA, { recursive: true });
for (const [nome, tam, fundo] of SAIDAS) {
  writeFileSync(join(SAIDA, nome), codificarPng(desenhar(tam, fundo), tam));
  console.log(`web/img/${nome} (${tam}x${tam}, ${fundo})`);
}
