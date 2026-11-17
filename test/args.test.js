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
  const destino = a[a.indexOf('tee') + 1];
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

test('saidasExtras como função do estado: so-som não leva saída de vídeo', () => {
  const extras = (estado, { video }) => (video ? [['-map', video, '-f', 'rawvideo', '-y', 'x']] : []);
  const gravando = montarArgs(cfg, { estado: 'gravando', saidasExtras: extras });
  assert.deepEqual(gravando.slice(-6), ['-map', '0:v', '-f', 'rawvideo', '-y', 'x']);
  const soSom = montarArgs(cfg, { estado: 'so-som', saidasExtras: extras });
  assert.ok(!soSom.includes('0:v'));
  assert.ok(!soSom.includes('rawvideo'));
});

test('a função de extras recebe o estado e os rótulos de entrada', () => {
  const vistos = [];
  montarArgs({ ...cfg, fonte: 'teste' }, { estado: 'gravando', saidasExtras: (e, ent) => { vistos.push([e, ent]); return []; } });
  assert.deepEqual(vistos, [['gravando', { video: '0:v', audio: '1:a' }]]);
});

test('-y global: o ffmpeg nunca pergunta "overwrite?" (o stdin é o canal do q)', () => {
  const a = montarArgs(cfg);
  assert.ok(a.indexOf('-y') > -1 && a.indexOf('-y') < a.indexOf('-i'));
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

test('so-som: só o microfone, sem vídeo, trechos e HLS de áudio', () => {
  const a = montarArgs(cfg, { estado: 'so-som' });
  const j = a.join(' ');
  assert.equal(a[a.indexOf('-i') + 1], 'audio=Microfone (fifine  Microphone)');
  assert.ok(!j.includes('video='));
  assert.ok(!j.includes('libx264'));
  assert.ok(!j.includes('-video_size'));
  assert.match(j, /-c:a aac/);
  assert.ok(a[a.indexOf('tee') + 1].includes('trechos/%Y-%m-%d/%H-%M-%S.mp4'));
});

test('saída PCM por pipe vem depois do tee e antes das extras', () => {
  const extra = ['-f', 'null', '-'];
  const a = montarArgs({ ...cfg, ouvirHz: 16000 }, { saidasExtras: [extra] });
  const pcm = ['-map', '0:a', '-c:a', 'pcm_s16le', '-ar', '16000', '-ac', '1', '-f', 's16le', 'pipe:1'];
  const i = a.indexOf('pcm_s16le') - 3;
  assert.deepEqual(a.slice(i, i + pcm.length), pcm);
  assert.ok(i > a.indexOf('tee'));
  assert.deepEqual(a.slice(-extra.length), extra);
});

test('qualidade e áudio vêm da configuração', () => {
  const j = montarArgs({ ...cfg, crf: 28, preset: 'ultrafast', audioBitrate: '64k', audioHz: 22050 }).join(' ');
  assert.match(j, /-crf 28/);
  assert.match(j, /-preset ultrafast/);
  assert.match(j, /-b:a 64k/);
  assert.match(j, /-ar 22050/);
});

test('fonte de teste usa lavfi em tempo real, sem dshow', () => {
  const a = montarArgs({ ...cfg, fonte: 'teste' });
  const j = a.join(' ');
  assert.ok(!j.includes('dshow'));
  assert.match(j, /-re /);
  assert.match(j, /testsrc/);
  assert.match(j, /sine/);
  assert.match(j, /-map 0:v -map 1:a/);
  const so = montarArgs({ ...cfg, fonte: 'teste' }, { estado: 'so-som' }).join(' ');
  assert.ok(!so.includes('testsrc'));
  assert.match(so, /-map 0:a/);
});

test('estado parado não tem argumentos', () => {
  assert.throws(() => montarArgs(cfg, { estado: 'parado' }), /parado/);
});

test('-framerate usa fpsCamera quando definido, senão o fps de gravação', () => {
  assert.match(montarArgs({ ...cfg, fpsCamera: null }).join(' '), /-framerate 15 /);
  assert.match(montarArgs({ ...cfg }).join(' '), /-framerate 15 /);
  assert.match(montarArgs({ ...cfg, fpsCamera: 30 }).join(' '), /-framerate 30 /);
});
