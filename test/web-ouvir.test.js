import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planejarBloco, pcm16ParaFloat32, decidirMp3, escolherModo, decidirSomAoAbrir } from '../web/js/ouvir.js';

const base = { duracao: 0.1, folga: 0.3, atrasoMax: 1 };

test('primeiro bloco começa com a folga', () => {
  const r = planejarBloco({ ...base, agora: 5, proximoInicio: 0 });
  assert.equal(r.inicio, 5.3);
  assert.equal(r.descartar, false);
  assert.ok(Math.abs(r.proximo - 5.4) < 1e-9);
});

test('bloco seguinte emenda no anterior', () => {
  const r = planejarBloco({ ...base, agora: 5.1, proximoInicio: 5.4 });
  assert.equal(r.inicio, 5.4);
  assert.equal(r.descartar, false);
});

test('falta de dados (underrun) recomeça com a folga', () => {
  const r = planejarBloco({ ...base, agora: 9, proximoInicio: 6 });
  assert.equal(r.inicio, 9.3);
});

test('atraso acima do máximo descarta e não avança o relógio', () => {
  const r = planejarBloco({ ...base, agora: 5, proximoInicio: 6.5 });
  assert.equal(r.descartar, true);
  assert.equal(r.proximo, 6.5);
  const limite = planejarBloco({ ...base, agora: 5, proximoInicio: 6 });
  assert.equal(limite.descartar, false);
});

test('PCM: converte s16le e guarda byte ímpar para o próximo bloco', () => {
  const a = pcm16ParaFloat32(new Uint8Array([0x00, 0x40, 0xFF]));
  assert.equal(a.amostras.length, 1);
  assert.equal(a.amostras[0], 0.5);
  assert.equal(a.sobra, 0xFF);
  const b = pcm16ParaFloat32(new Uint8Array([0x7F, 0x00, 0x80]), a.sobra);
  assert.equal(b.amostras.length, 2);
  assert.ok(Math.abs(b.amostras[0] - 32767 / 32768) < 1e-9);
  assert.equal(b.amostras[1], -1);
  assert.equal(b.sobra, null);
});

test('PCM: bloco de um byte só e bloco vazio', () => {
  const r = pcm16ParaFloat32(new Uint8Array([1]));
  assert.equal(r.amostras.length, 0);
  assert.equal(r.sobra, 1);
  assert.equal(pcm16ParaFloat32(new Uint8Array(0)).sobra, null);
});

test('PCM: respeita o byteOffset de uma vista', () => {
  const grande = new Uint8Array([9, 9, 0x00, 0x40]);
  const r = pcm16ParaFloat32(grande.subarray(2));
  assert.equal(r.amostras[0], 0.5);
});

test('MP3: nada, saltar e recarregar', () => {
  assert.equal(decidirMp3({ atraso: 3, max: 4, saltouAntes: false }), 'nada');
  assert.equal(decidirMp3({ atraso: 5, max: 4, saltouAntes: false }), 'saltar');
  assert.equal(decidirMp3({ atraso: 5, max: 4, saltouAntes: true }), 'recarregar');
});

test('modo por tela de toque', () => {
  assert.equal(escolherModo('auto', true), 'mp3');
  assert.equal(escolherModo('auto', false), 'pcm');
  assert.equal(escolherModo('pcm', true), 'pcm');
  assert.equal(escolherModo('mp3', false), 'mp3');
});

test('som ao abrir: o valor salvo vale mais que a configuração', () => {
  assert.equal(decidirSomAoAbrir({ somAoAbrir: true, salvo: null }), true);
  assert.equal(decidirSomAoAbrir({ somAoAbrir: false, salvo: null }), false);
  assert.equal(decidirSomAoAbrir({ somAoAbrir: true, salvo: 'silenciado' }), false);
  assert.equal(decidirSomAoAbrir({ somAoAbrir: false, salvo: 'ligado' }), true);
  assert.equal(decidirSomAoAbrir({ somAoAbrir: true, salvo: 'lixo' }), true);
  assert.equal(decidirSomAoAbrir({ somAoAbrir: undefined, salvo: null }), true);
});
