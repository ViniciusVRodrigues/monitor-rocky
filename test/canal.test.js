import { test } from 'node:test';
import assert from 'node:assert/strict';
import { servirCanal, enviarComando, SemMonitorErro } from '../src/canal.js';

const nome = () => `rocky-teste-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

function falsos() {
  const gravador = {
    e: 'gravando',
    estado() { return this.e; },
    async iniciar() { this.e = 'gravando'; return this.e; },
    async parar() { this.e = 'parado'; return this.e; },
    async camera(v) {
      if (v !== 'ligar' && v !== 'desligar') throw new Error('Use ligar ou desligar.');
      this.e = v === 'desligar' ? 'so-som' : 'gravando'; return this.e;
    },
  };
  const ouvinte = { on: false, ativo() { return this.on; }, ligar() { this.on = true; }, desligar() { this.on = false; } };
  return { gravador, ouvinte };
}

test('comandos de ida e volta pelo canal', async () => {
  const n = nome();
  const { gravador, ouvinte } = falsos();
  const srv = await servirCanal({ nome: n, gravador, ouvinte });
  try {
    assert.deepEqual(await enviarComando(n, { cmd: 'estado' }), { ok: true, estado: 'gravando', ouvindo: false });
    assert.equal((await enviarComando(n, { cmd: 'camera', valor: 'desligar' })).estado, 'so-som');
    assert.equal((await enviarComando(n, { cmd: 'parar' })).estado, 'parado');
    assert.equal((await enviarComando(n, { cmd: 'iniciar' })).estado, 'gravando');
    assert.equal((await enviarComando(n, { cmd: 'ouvir', valor: 'ligar' })).ouvindo, true);
    assert.equal((await enviarComando(n, { cmd: 'ouvir', valor: 'desligar' })).ouvindo, false);
  } finally { await srv.fechar(); }
});

test('erros voltam como ok:false com mensagem, sem derrubar o servidor', async () => {
  const n = nome();
  const { gravador, ouvinte } = falsos();
  const srv = await servirCanal({ nome: n, gravador, ouvinte });
  try {
    const r = await enviarComando(n, { cmd: 'camera', valor: 'talvez' });
    assert.equal(r.ok, false);
    assert.match(r.erro, /ligar/);
    assert.equal((await enviarComando(n, { cmd: 'nada' })).ok, false);
    assert.equal((await enviarComando(n, { cmd: 'estado' })).ok, true);
  } finally { await srv.fechar(); }
});

test('sem monitor rodando: erro em pt-BR sugerindo npm start', async () => {
  await assert.rejects(enviarComando(nome(), { cmd: 'estado' }), (e) => e instanceof SemMonitorErro && /npm start/.test(e.message));
});
