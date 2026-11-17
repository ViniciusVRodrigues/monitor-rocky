import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { carregarConfig, validarDispositivos, ConfigErro } from '../src/config.js';

function raizTemp(padrao, local) {
  const raiz = mkdtempSync(join(tmpdir(), 'rocky-cfg-'));
  writeFileSync(join(raiz, 'config.json'), JSON.stringify(padrao));
  if (local !== undefined) writeFileSync(join(raiz, 'config.local.json'), JSON.stringify(local));
  return raiz;
}

test('config local sobrepõe a padrão e mantém os demais valores', () => {
  const raiz = raizTemp({ video: '', audio: '', trechoSegundos: 60, bufferHoras: 4, pasta: 'gravacoes' }, { video: 'FHD Camera' });
  try {
    const cfg = carregarConfig(raiz);
    assert.equal(cfg.video, 'FHD Camera');
    assert.equal(cfg.trechoSegundos, 60);
    assert.equal(cfg.bufferHoras, 4);
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});

test('funciona sem config.local.json e resolve a pasta relativa à raiz', () => {
  const raiz = raizTemp({ video: 'a', audio: 'b', pasta: 'gravacoes', trechoSegundos: 60, bufferHoras: 4 });
  try {
    assert.equal(carregarConfig(raiz).pasta, resolve(raiz, 'gravacoes'));
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});

test('rejeita números inválidos', () => {
  const raiz = raizTemp({ video: 'a', audio: 'b', pasta: 'g', trechoSegundos: 0, bufferHoras: 4 });
  try {
    assert.throws(() => carregarConfig(raiz), ConfigErro);
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});

test('dispositivo vazio gera mensagem em pt-BR sugerindo npm run dispositivos', () => {
  for (const cfg of [{ video: '', audio: 'x' }, { video: 'x', audio: '  ' }]) {
    assert.throws(() => validarDispositivos(cfg), (e) => e instanceof ConfigErro && /npm run dispositivos/.test(e.message));
  }
  assert.doesNotThrow(() => validarDispositivos({ video: 'a', audio: 'b' }));
});

test('valida as chaves novas quando presentes', () => {
  for (const ruim of [{ fps: 0 }, { estadoInicial: 'voando' }, { canalControle: ' ' }, { ouvirHz: -1 }]) {
    const raiz = raizTemp({ video: 'a', audio: 'b', pasta: 'g', trechoSegundos: 60, bufferHoras: 4, ...ruim });
    try { assert.throws(() => carregarConfig(raiz), ConfigErro); } finally { rmSync(raiz, { recursive: true, force: true }); }
  }
});

test('fonte de teste dispensa câmera e microfone', () => {
  assert.doesNotThrow(() => validarDispositivos({ fonte: 'teste', video: '', audio: '' }));
});
