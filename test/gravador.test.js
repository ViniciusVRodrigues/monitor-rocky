import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { criarGravador } from '../src/gravador.js';

function cenario(inicial) {
  const pasta = mkdtempSync(join(tmpdir(), 'rocky-grav-'));
  if (inicial) writeFileSync(join(pasta, 'estado.json'), JSON.stringify({ estado: inicial }));
  const chamadas = [];
  const sup = {
    reiniciar: async () => { chamadas.push('reiniciar'); },
    definirAtivo: async (v) => { chamadas.push(`ativo:${v}`); },
    parar: async () => { chamadas.push('parar'); },
  };
  const g = criarGravador({ cfg: { pasta, estadoInicial: 'gravando' }, supervisor: sup, log: () => {} });
  return { pasta, chamadas, g, limpar: () => rmSync(pasta, { recursive: true, force: true }) };
}

test('sem arquivo começa em gravando', () => {
  const c = cenario();
  try { assert.equal(c.g.estado(), 'gravando'); } finally { c.limpar(); }
});

test('restaura o estado do arquivo; arquivo inválido cai no padrão', () => {
  const c = cenario('so-som');
  try { assert.equal(c.g.estado(), 'so-som'); } finally { c.limpar(); }
  const d = cenario('bagunça');
  try { assert.equal(d.g.estado(), 'gravando'); } finally { d.limpar(); }
});

test('camera desligar/ligar alterna gravando e so-som e reinicia o ffmpeg', async () => {
  const c = cenario();
  try {
    assert.equal(await c.g.camera('desligar'), 'so-som');
    assert.equal(await c.g.camera('ligar'), 'gravando');
    assert.deepEqual(c.chamadas, ['reiniciar', 'reiniciar']);
  } finally { c.limpar(); }
});

test('parar desativa o supervisor e esvazia o aovivo; iniciar volta a gravar', async () => {
  const c = cenario();
  try {
    mkdirSync(join(c.pasta, 'aovivo'));
    writeFileSync(join(c.pasta, 'aovivo', 'seg00001.ts'), 'x');
    writeFileSync(join(c.pasta, 'aovivo', 'index.m3u8'), 'x');
    assert.equal(await c.g.parar(), 'parado');
    assert.deepEqual(readdirSync(join(c.pasta, 'aovivo')), []);
    assert.equal(await c.g.iniciar(), 'gravando');
    assert.deepEqual(c.chamadas, ['ativo:false', 'ativo:true']);
  } finally { c.limpar(); }
});

test('camera em parado não liga nada', async () => {
  const c = cenario('parado');
  try {
    await assert.rejects(c.g.camera('ligar'), /parado/);
    assert.equal(c.g.estado(), 'parado');
  } finally { c.limpar(); }
});

test('estado é gravado de forma atômica e sobrevive a um novo gravador', async () => {
  const c = cenario();
  try {
    await c.g.camera('desligar');
    const arq = JSON.parse(readFileSync(join(c.pasta, 'estado.json'), 'utf8'));
    assert.equal(arq.estado, 'so-som');
    assert.ok(!existsSync(join(c.pasta, 'estado.json.tmp')));
    const g2 = criarGravador({ cfg: { pasta: c.pasta, estadoInicial: 'gravando' }, supervisor: {}, log: () => {} });
    assert.equal(g2.estado(), 'so-som');
  } finally { c.limpar(); }
});

test('mudar para o estado em que já está não reinicia; valor inválido é rejeitado', async () => {
  const c = cenario();
  try {
    await c.g.definirEstado('gravando');
    assert.deepEqual(c.chamadas, []);
    await assert.rejects(c.g.definirEstado('voando'), /inválido/);
    await assert.rejects(c.g.camera('talvez'), /ligar|desligar/);
  } finally { c.limpar(); }
});

test('avisa quem escuta mudanças de estado', async () => {
  const c = cenario();
  try {
    const vistos = [];
    c.g.aoMudar((e) => vistos.push(e));
    await c.g.camera('desligar');
    assert.deepEqual(vistos, ['so-som']);
  } finally { c.limpar(); }
});

test('parar e iniciar seguidos são executados em ordem (limpeza do aovivo antes de religar)', async () => {
  const c = cenario();
  try {
    mkdirSync(join(c.pasta, 'aovivo'));
    writeFileSync(join(c.pasta, 'aovivo', 'a.ts'), 'x');
    const [a, b] = await Promise.all([c.g.parar(), c.g.iniciar()]);
    assert.deepEqual([a, b], ['parado', 'gravando']);
    assert.deepEqual(c.chamadas, ['ativo:false', 'ativo:true']);
    assert.deepEqual(readdirSync(join(c.pasta, 'aovivo')), []);
  } finally { c.limpar(); }
});
