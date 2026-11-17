/**
 * Montagem dos argumentos do ffmpeg (função pura).
 *
 * Um único processo abre a câmera e o microfone (DirectShow só abre cada
 * dispositivo uma vez) e codifica uma vez, enviando o resultado por um muxer
 * `tee` para dois destinos, relativos à pasta de gravações (cwd do ffmpeg):
 *   - trechos/AAAA-MM-DD/HH-MM-SS.mp4  (trechos de `trechoSegundos`)
 *   - aovivo/index.m3u8                (HLS ao vivo, janela curta)
 *
 * Estados (`estado`):
 *   - gravando: câmera + microfone (vídeo H.264 + áudio AAC);
 *   - so-som:   só o microfone (a câmera fica livre); trechos e HLS só de áudio;
 *   - parado:   sem processo (não há argumentos).
 *
 * Depois do tee vai uma saída de áudio PCM por `pipe:1` (para ouvir ao vivo e
 * para análise de som). Depois dela, `saidasExtras` permite acrescentar outras
 * saídas completas (listas de argumentos, ex.: análise de movimento no ROCKY-2).
 *
 * `fonte: "teste"` troca o DirectShow por fontes sintéticas (lavfi), para
 * testar sem câmera.
 */

export function padraoTrecho() {
  return 'trechos/%Y-%m-%d/%H-%M-%S.mp4';
}

export function destinoTee(cfg) {
  // MP4 fragmentado: um trecho cortado por queda/kill continua tocável.
  const trechos =
    `[f=segment:segment_time=${cfg.trechoSegundos}:strftime=1:reset_timestamps=1:` +
    `segment_format=mp4:segment_format_options=movflags=+frag_keyframe+empty_moov+default_base_moof]` +
    padraoTrecho();
  const aovivo =
    `[f=hls:hls_time=${cfg.aovivoSegundos}:hls_list_size=${cfg.aovivoSegmentos}:` +
    `hls_flags=delete_segments+independent_segments:` +
    `hls_segment_filename=aovivo/seg%05d.ts]aovivo/index.m3u8`;
  return `${trechos}|${aovivo}`;
}

function entrada(cfg, comVideo) {
  const audioHz = cfg.audioHz ?? 44100;
  if (cfg.fonte === 'teste') {
    const seno = ['-re', '-f', 'lavfi', '-i', `sine=frequency=440:sample_rate=${audioHz}`];
    if (!comVideo) return { args: seno, video: null, audio: '0:a' };
    return {
      args: ['-re', '-f', 'lavfi', '-i', `testsrc=size=${cfg.resolucao}:rate=${cfg.fpsCamera ?? 30}`, ...seno],
      video: '0:v', audio: '1:a',
    };
  }
  if (!comVideo) {
    return { args: ['-f', 'dshow', '-i', `audio=${cfg.audio}`], video: null, audio: '0:a' };
  }
  return {
    args: [
      '-f', 'dshow', '-rtbufsize', '256M',
      '-framerate', String(cfg.fpsCamera ?? 30),
      '-video_size', cfg.resolucao,
      '-i', `video=${cfg.video}:audio=${cfg.audio}`,
    ],
    video: '0:v', audio: '0:a',
  };
}

export function montarArgs(cfg, { estado = 'gravando', saidasExtras = [] } = {}) {
  if (estado === 'parado') throw new Error('Estado parado: não há o que capturar.');
  const comVideo = estado === 'gravando';
  const fps = Number(cfg.fps);
  const gop = Math.max(1, Math.round(fps * cfg.aovivoSegundos));
  const ent = entrada(cfg, comVideo);

  const args = ['-hide_banner', '-loglevel', 'warning', ...ent.args];
  if (comVideo) {
    args.push(
      '-map', ent.video, '-map', ent.audio,
      '-r', String(fps),
      '-c:v', 'libx264', '-preset', String(cfg.preset ?? 'veryfast'), '-crf', String(cfg.crf ?? 23),
      '-tune', 'zerolatency',
      '-pix_fmt', 'yuv420p', '-g', String(gop), '-keyint_min', String(gop), '-sc_threshold', '0',
      '-force_key_frames', `expr:gte(t,n_forced*${cfg.aovivoSegundos})`,
    );
  }
  else args.push('-map', ent.audio);
  // global_header é obrigatório: sem ele o MP4 dentro do tee sai sem SPS/PPS e não toca.
  args.push(
    '-flags', '+global_header',
    '-c:a', 'aac', '-b:a', String(cfg.audioBitrate ?? '96k'),
    '-ar', String(cfg.audioHz ?? 44100), '-ac', String(cfg.audioCanais ?? 1),
    '-f', 'tee', destinoTee(cfg),
  );
  // Áudio PCM cru para o distribuidor (ouvir ao vivo, detecção de som).
  args.push(
    '-map', ent.audio, '-c:a', 'pcm_s16le', '-ar', String(cfg.ouvirHz ?? 16000), '-ac', '1',
    '-f', 's16le', 'pipe:1',
  );
  for (const extra of saidasExtras) args.push(...extra);
  return args;
}
