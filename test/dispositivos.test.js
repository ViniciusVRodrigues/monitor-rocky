import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsearDispositivos } from '../src/dispositivos.js';

const NOVO = `
[in#0 @ 0000023efed05800] "FHD Camera" (video)
[in#0 @ 0000023efed05800]   Alternative name "@device_pnp_usb#vid_1bcf"
[in#0 @ 0000023efed05800] "OBS Virtual Camera" (none)
[in#0 @ 0000023efed05800]   Alternative name "@device_sw_{860BB310}"
[in#0 @ 0000023efed05800] "Microfone (fifine  Microphone)" (audio)
[in#0 @ 0000023efed05800]   Alternative name "@device_cm_{33D9A762}"
[in#0 @ 0000023efed05800] "Microfone do Headset (usb audio voice)" (audio)
Error opening input file dummy.
`;

const ANTIGO = `
[dshow @ 0000] DirectShow video devices (some may be both video and audio devices)
[dshow @ 0000]  "Integrated Camera"
[dshow @ 0000]     Alternative name "@device_pnp_x"
[dshow @ 0000] DirectShow audio devices
[dshow @ 0000]  "Microphone Array"
[dshow @ 0000]     Alternative name "@device_cm_y"
`;

test('formato novo: separa vídeo e áudio, ignora nomes alternativos e (none)', () => {
  const r = parsearDispositivos(NOVO);
  assert.deepEqual(r.video, ['FHD Camera']);
  assert.deepEqual(r.audio, ['Microfone (fifine  Microphone)', 'Microfone do Headset (usb audio voice)']);
});

test('preserva espaços duplos do nome', () => {
  assert.ok(parsearDispositivos(NOVO).audio[0].includes('fifine  Microphone'));
});

test('formato antigo com cabeçalhos de seção', () => {
  const r = parsearDispositivos(ANTIGO);
  assert.deepEqual(r.video, ['Integrated Camera']);
  assert.deepEqual(r.audio, ['Microphone Array']);
});

test('saída vazia', () => {
  assert.deepEqual(parsearDispositivos(''), { video: [], audio: [] });
});
