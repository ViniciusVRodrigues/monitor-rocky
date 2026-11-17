import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { avaliarDispositivos, ehFalhaDoFfmpeg, criarSaude } from '../src/saude.js';

const SAIDA = `[dshow @ 0] DirectShow video devices (some may be both video and audio devices)
[dshow @ 0]  "FHD Camera" (video)
[dshow @ 0]     Alternative name "@device_pnp_x"
[dshow @ 0] DirectShow audio devices
[dshow @ 0]  "Microfone (fifine  Microphone)" (audio)`;
const SEM_CAMERA = SAIDA.replace(/.*FHD Camera.*\n/, '');
const cfg = { video: 'FHD Camera', audio: 'Microfone (fifine  Microphone)', fonte: 'dshow' };
const FALHA = 'ffmpeg saiu com código 1. Reiniciando em 1 s.';
const OK = { camera: 'ok', microfone: 'ok' };

test('avaliarDispositivos com saída sintética do ffmpeg', () => {
  assert.deepEqual(avaliarDispositivos(SAIDA, cfg, 'gravando'), OK);
  assert.deepEqual(avaliarDispositivos(SEM_CAMERA, cfg, 'gravando'), { camera: 'sumiu', microfone: 'ok' });
  assert.deepEqual(avaliarDispositivos('', cfg, 'gravando'), { camera: 'sumiu', microfone: 'sumiu' });
});

test('só-som não verifica a câmera; parado não verifica nada; fonte teste ignora', () => {
  assert.deepEqual(avaliarDispositivos(SEM_CAMERA, cfg, 'so-som'), OK);
  assert.deepEqual(avaliarDispositivos('', cfg, 'parado'), OK);
  assert.deepEqual(avaliarDispositivos('', { ...cfg, fonte: 'teste' }, 'gravando'), OK);
});

test('ehFalhaDoFfmpeg reconhece as linhas do supervisor', () => {
  assert.ok(ehFalhaDoFfmpeg('17/11/2026 10:00:00 ffmpeg saiu com código 1. Reiniciando em 2 s.'));
  assert.ok(ehFalhaDoFfmpeg('x ffmpeg erro ao executar: spawn ffmpeg ENOENT. Reiniciando em 1 s.'));
  assert.ok(!ehFalhaDoFfmpeg('Monitor no ar: estado "gravando"'));
});

function montar(extra = {}) {
  const pasta = mkdtempSync(join(tmpdir(), 'rocky-saude-'));
  const alertas = [];
  let lista = SAIDA;
  let agora = 0;
  const s = criarSaude({
    cfg: { ...cfg, pasta, alertaFalhasSeguidas: 3, alertaEstavelSegundos: 120 },
    listar: () => lista, lerEstado: () => 'gravando', relogio: () => agora,
    aoAlerta: (a) => alertas.push(a), toast: false, log: () => {}, ...extra,
  });
  return {
    s, alertas, set: (l) => { lista = l; }, tempo: (ms) => { agora += ms; },
    limpar: () => rmSync(pasta, { recursive: true, force: true }),
    lerJson: () => JSON.parse(readFileSync(join(pasta, 'saude.json'), 'utf8')),
  };
}

test('dispositivo some: um alerta, saude.json, e um aviso de recuperação', async () => {
  const t = montar();
  try {
    await t.s.verificar();
    assert.equal(t.alertas.length, 0);
    assert.equal(t.lerJson().camera, 'ok');
    t.set(SEM_CAMERA);
    await t.s.verificar();
    await t.s.verificar();
    assert.equal(t.alertas.length, 1);
    assert.equal(t.alertas[0].tipo, 'camera');
    assert.equal(t.alertas[0].problema, true);
    assert.match(t.alertas[0].mensagem, /câmera/i);
    assert.equal(t.lerJson().camera, 'sumiu');
    t.set(SAIDA);
    await t.s.verificar();
    assert.equal(t.alertas.length, 2);
    assert.equal(t.alertas[1].problema, false);
    assert.equal(t.lerJson().camera, 'ok');
  } finally { t.limpar(); }
});

test('3 falhas seguidas alertam captura; estável por 120 s zera a contagem', async () => {
  const t = montar();
  try {
    t.s.registrarLinha(FALHA); t.s.registrarLinha(FALHA);
    assert.equal(t.alertas.length, 0);
    t.tempo(121000);
    t.s.registrarLinha(FALHA);
    assert.equal(t.alertas.length, 0);
    t.s.registrarLinha(FALHA); t.s.registrarLinha(FALHA);
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(t.alertas.length, 1);
    assert.equal(t.alertas[0].tipo, 'captura');
  } finally { t.limpar(); }
});

test('na falha seguida, a lista de dispositivos aponta qual sumiu', async () => {
  const t = montar();
  try {
    t.set(SEM_CAMERA);
    for (let i = 0; i < 3; i++) t.s.registrarLinha(FALHA);
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(t.alertas.length, 1);
    assert.equal(t.alertas[0].tipo, 'camera');
  } finally { t.limpar(); }
});

test('erro do gancho aoAlerta não derruba a saúde', async () => {
  const t = montar({ aoAlerta: () => { throw new Error('boom'); } });
  try { t.set(SEM_CAMERA); await t.s.verificar(); assert.equal(t.lerJson().camera, 'sumiu'); } finally { t.limpar(); }
});
