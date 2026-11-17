import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
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

test('valida guardadosPasta e guardarMaxArquivos', () => {
  for (const ruim of [{ guardadosPasta: '../fora' }, { guardadosPasta: 'trechos' }, { guardadosPasta: 'Clipes' }, { guardadosPasta: '' },
    { guardadosPasta: 'a/b' }, { guardarMaxArquivos: 0 }, { guardarMaxArquivos: 2.5 }, { guardarMaxArquivos: '10' }]) {
    const raiz = raizTemp({ video: 'a', audio: 'b', pasta: 'g', trechoSegundos: 60, bufferHoras: 4, ...ruim });
    try { assert.throws(() => carregarConfig(raiz), ConfigErro, JSON.stringify(ruim)); } finally { rmSync(raiz, { recursive: true, force: true }); }
  }
  const raiz = raizTemp({ video: 'a', audio: 'b', pasta: 'g', trechoSegundos: 60, bufferHoras: 4, guardadosPasta: 'meus', guardarMaxArquivos: 30 });
  try { assert.equal(carregarConfig(raiz).guardadosPasta, 'meus'); } finally { rmSync(raiz, { recursive: true, force: true }); }
});

test('fonte de teste dispensa câmera e microfone', () => {
  assert.doesNotThrow(() => validarDispositivos({ fonte: 'teste', video: '', audio: '' }));
});

test('chaves do servidor e do nível do som são validadas', () => {
  const base = { trechoSegundos: 60, bufferHoras: 4, pasta: 'gravacoes' };
  const ruins = [
    { servidorPorta: 0 }, { ouvirSiteMax: -1 }, { nivelHz: 0 }, { ouvirModo: 'wav' },
    { hostsPermitidos: 'a.com' }, { hostsPermitidos: [1] }, { nivelSuavizacao: 1 }, { nivelSuavizacao: -0.1 },
    { nivelPisoDb: 0 }, { nivelPisoDb: '-60' }, { somAoAbrir: 'sim' },
  ];
  for (const r of ruins) {
    const raiz = raizTemp({ ...base, ...r });
    try { assert.throws(() => carregarConfig(raiz), ConfigErro, JSON.stringify(r)); } finally { rmSync(raiz, { recursive: true, force: true }); }
  }
  const raiz = raizTemp({ ...base, servidorPorta: 8321, ouvirModo: 'mp3', hostsPermitidos: ['a.com'], nivelSuavizacao: 0, nivelPisoDb: -50, somAoAbrir: false });
  try { assert.equal(carregarConfig(raiz).ouvirModo, 'mp3'); } finally { rmSync(raiz, { recursive: true, force: true }); }
});

test('chaves novas: fpsCamera null vale (usa fps); prioridades e log* validados', () => {
  const base = { video: '', audio: '', trechoSegundos: 60, bufferHoras: 4, pasta: 'g' };
  const ok = {
    fpsCamera: null, tarefaPrioridade: 3, ffmpegPrioridade: 'acima', clipePrioridade: 'abaixo', clipeCopiar: true,
    logJanelaSegundos: 10, logLinhasPorJanela: 20, logFilaMaxKB: 1024,
  };
  const r = raizTemp({ ...base, ...ok });
  try { assert.equal(carregarConfig(r).fpsCamera, null); } finally { rmSync(r, { recursive: true, force: true }); }
  for (const ruim of [{ fpsCamera: 0 }, { tarefaPrioridade: 11 }, { tarefaPrioridade: 1.5 }, { ffmpegPrioridade: 'tempo-real' },
    { clipePrioridade: 'x' }, { clipeCopiar: 'sim' }, { logJanelaSegundos: 0 }, { logLinhasPorJanela: -1 }, { logFilaMaxKB: 0 }]) {
    const d = raizTemp({ ...base, ...ok, ...ruim });
    try { assert.throws(() => carregarConfig(d), ConfigErro, JSON.stringify(ruim)); } finally { rmSync(d, { recursive: true, force: true }); }
  }
});

test('apagarHoraTrechos precisa ser booleano e vem no config.json como true', () => {
  for (const ruim of [{ apagarHoraTrechos: 'sim' }, { apagarHoraTrechos: 1 }, { apagarHoraTrechos: null }]) {
    const raiz = raizTemp({ video: 'a', audio: 'b', pasta: 'g', trechoSegundos: 60, bufferHoras: 4, ...ruim });
    try { assert.throws(() => carregarConfig(raiz), ConfigErro, JSON.stringify(ruim)); } finally { rmSync(raiz, { recursive: true, force: true }); }
  }
  const raiz = raizTemp({ video: 'a', audio: 'b', pasta: 'g', trechoSegundos: 60, bufferHoras: 4, apagarHoraTrechos: false });
  try { assert.equal(carregarConfig(raiz).apagarHoraTrechos, false); } finally { rmSync(raiz, { recursive: true, force: true }); }
  const padrao = JSON.parse(readFileSync(new URL('../config.json', import.meta.url), 'utf8'));
  assert.equal(padrao.apagarHoraTrechos, true);
});
