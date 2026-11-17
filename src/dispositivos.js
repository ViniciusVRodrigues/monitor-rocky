import { spawnSync } from 'node:child_process';

/**
 * Extrai os nomes de câmeras e microfones da saída de
 * `ffmpeg -list_devices true -f dshow -i dummy` (formatos novo e antigo).
 */
export function parsearDispositivos(saida) {
  const r = { video: [], audio: [] };
  let secao = null;
  for (const linha of String(saida).split(/\r?\n/)) {
    if (/Alternative name/i.test(linha)) continue;
    if (/DirectShow video devices/i.test(linha)) { secao = 'video'; continue; }
    if (/DirectShow audio devices/i.test(linha)) { secao = 'audio'; continue; }
    // formato novo: "Nome" (video|audio|none)
    let m = linha.match(/"(.+)"\s+\((video|audio|none)\)\s*$/);
    if (m) {
      if (m[2] !== 'none') r[m[2]].push(m[1]);
      continue;
    }
    // formato antigo: só "Nome", dentro de uma seção
    m = linha.match(/\]\s+"(.+)"\s*$/);
    if (m && secao) r[secao].push(m[1]);
  }
  return r;
}

export function listarDispositivos(ffmpeg = 'ffmpeg') {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-list_devices', 'true', '-f', 'dshow', '-i', 'dummy'], {
    encoding: 'utf8',
  });
  if (r.error) {
    throw new Error(`Não consegui executar o ffmpeg ("${ffmpeg}"): ${r.error.message}`);
  }
  // o ffmpeg escreve a lista no stderr e sai com erro por causa do "dummy"
  return parsearDispositivos(`${r.stderr ?? ''}\n${r.stdout ?? ''}`);
}
