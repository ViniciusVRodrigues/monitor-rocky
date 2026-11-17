/**
 * Montagem dos argumentos do ffmpeg (função pura).
 *
 * Um único processo abre a câmera e o microfone (DirectShow só abre cada
 * dispositivo uma vez) e codifica uma vez, enviando o resultado por um muxer
 * `tee` para dois destinos, relativos à pasta de gravações (cwd do ffmpeg):
 *   - trechos/AAAA-MM-DD/HH-MM-SS.mp4  (trechos de `trechoSegundos`)
 *   - aovivo/index.m3u8                (HLS ao vivo, janela curta)
 *
 * `saidasExtras` permite acrescentar outras saídas completas (listas de
 * argumentos, ex.: um fluxo para análise de movimento no ROCKY-2).
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

export function montarArgs(cfg, { saidasExtras = [] } = {}) {
  const fps = Number(cfg.fps);
  const gop = Math.max(1, Math.round(fps * cfg.aovivoSegundos));
  const args = [
    '-hide_banner', '-loglevel', 'warning',
    '-f', 'dshow',
    '-rtbufsize', '256M',
    '-framerate', String(cfg.fpsCamera ?? 30),
    '-video_size', cfg.resolucao,
    '-i', `video=${cfg.video}:audio=${cfg.audio}`,
    '-map', '0:v', '-map', '0:a',
    '-r', String(fps),
    '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'zerolatency',
    '-flags', '+global_header', '-pix_fmt', 'yuv420p', '-g', String(gop), '-keyint_min', String(gop), '-sc_threshold', '0',
    '-force_key_frames', `expr:gte(t,n_forced*${cfg.aovivoSegundos})`,
    '-c:a', 'aac', '-b:a', '96k', '-ar', '44100', '-ac', '1',
    '-f', 'tee', destinoTee(cfg),
  ];
  for (const extra of saidasExtras) args.push(...extra);
  return args;
}
