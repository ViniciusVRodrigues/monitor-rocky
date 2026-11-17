import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
import { avaliarDispositivos, ehFalhaDoFfmpeg, criarSaude, listarDispositivos } from '../src/saude.js';

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

function procPenduradoFalso() {
  const p = new EventEmitter();
  p.stdout = new EventEmitter();
  p.stderr = new EventEmitter();
  p.mortes = 0;
  p.kill = () => { p.mortes += 1; setImmediate(() => p.emit('close', null)); };
  return p;
}

test('listarDispositivos: ffmpeg que não responde no tempo é morto e vira erro de checagem', async () => {
  const p = procPenduradoFalso();
  await assert.rejects(
    listarDispositivos({ ffmpeg: 'ffmpeg', timeoutMs: 20, spawn: () => p }),
    /tempo/i,
  );
  assert.equal(p.mortes, 1);
});

test('listarDispositivos: resposta no tempo devolve a saída e não mata nada', async () => {
  const p = procPenduradoFalso();
  const r = listarDispositivos({ ffmpeg: 'ffmpeg', timeoutMs: 1000, spawn: () => p });
  p.stderr.emit('data', 'lista');
  p.emit('close', 0);
  assert.equal(await r, 'lista');
  assert.equal(p.mortes, 0);
});

test('timeout da checagem não conta como sumiço de dispositivo', async () => {
  const t = montar({ listar: () => Promise.reject(new Error('A checagem de dispositivos estourou o tempo.')) });
  try {
    await t.s.verificar();
    assert.deepEqual(t.s.situacao(), { camera: 'ok', microfone: 'ok', captura: 'ok' });
    assert.equal(t.alertas.length, 0);
  } finally { t.limpar(); }
});

test('criarSaude passa saudeTimeoutMs ao listar', async () => {
  let recebido;
  const pasta = mkdtempSync(join(tmpdir(), 'rocky-saude-'));
  try {
    const s = criarSaude({
      cfg: { ...cfg, pasta, saudeTimeoutMs: 1234 }, toast: false, log: () => {}, lerEstado: () => 'gravando',
      listarComTempo: (opcoes) => { recebido = opcoes; return SAIDA; },
    });
    await s.verificar();
    assert.equal(recebido.timeoutMs, 1234);
    assert.equal(recebido.ffmpeg, undefined === cfg.ffmpeg ? undefined : cfg.ffmpeg);
  } finally { rmSync(pasta, { recursive: true, force: true }); }
});
