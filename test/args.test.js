import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarArgs, padraoTrecho } from '../src/ffmpeg-args.js';

const cfg = {
  video: 'FHD Camera', audio: 'Microfone (fifine  Microphone)',
  trechoSegundos: 60, resolucao: '1280x720', fps: 15, aovivoSegundos: 2, aovivoSegmentos: 6,
};

test('abre câmera e microfone num único -i dshow', () => {
  const a = montarArgs(cfg);
  assert.equal(a.filter((x) => x === '-i').length, 1);
  assert.equal(a[a.indexOf('-i') + 1], 'video=FHD Camera:audio=Microfone (fifine  Microphone)');
  assert.ok(a.includes('dshow'));
});

test('uma saída tee com trechos (segment+strftime) e HLS', () => {
  const a = montarArgs(cfg);
  assert.equal(a[a.indexOf('tee') - 1], '-f');
  const destino = a[a.length - 1];
  assert.match(destino, /f=segment/);
  assert.match(destino, /segment_time=60/);
  assert.match(destino, /strftime=1/);
  assert.ok(destino.includes('trechos/%Y-%m-%d/%H-%M-%S.mp4'));
  assert.match(destino, /f=hls/);
  assert.match(destino, /hls_time=2/);
  assert.match(destino, /hls_list_size=6/);
  assert.match(destino, /delete_segments/);
  assert.ok(destino.includes('aovivo/index.m3u8'));
});

test('codifica uma vez só (h264 + aac) e mapeia vídeo e áudio', () => {
  const a = montarArgs(cfg).join(' ');
  assert.match(a, /-c:v libx264/);
  assert.match(a, /-c:a aac/);
  assert.match(a, /-map 0:v/);
  assert.match(a, /-map 0:a/);
});

test('saídas extras entram depois da principal (extensível para o ROCKY-2)', () => {
  const extra = ['-map', '0:v', '-f', 'null', '-'];
  const a = montarArgs(cfg, { saidasExtras: [extra] });
  assert.deepEqual(a.slice(-extra.length), extra);
  assert.ok(a.indexOf('tee') < a.length - extra.length);
});

test('lê da câmera a 30 fps e grava na taxa configurada', () => {
  const a = montarArgs({ ...cfg, fpsCamera: 30 }).join(' ');
  assert.match(a, /-framerate 30 /);
  assert.match(a, /-r 15 /);
});

test('usa global_header (sem ele o MP4 do tee sai sem SPS/PPS e não toca)', () => {
  assert.match(montarArgs(cfg).join(' '), /-flags \+global_header/);
});

test('padraoTrecho é relativo e usa barras', () => {
  assert.equal(padraoTrecho(), 'trechos/%Y-%m-%d/%H-%M-%S.mp4');
});
