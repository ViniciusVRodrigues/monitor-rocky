import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { parsearDispositivos } from './dispositivos.js';
import { enviarToast } from './toast.js';

const TEXTOS = {
  camera: ['A câmera sumiu.', 'A câmera voltou.'],
  microfone: ['O microfone sumiu.', 'O microfone voltou.'],
  captura: ['A captura está falhando seguidas vezes.', 'A captura voltou ao normal.'],
};

/** Lista os dispositivos DirectShow (o ffmpeg escreve no stderr). Só lista: não abre a câmera. */
function listarAssincrono(ffmpeg) {
  return new Promise((resolve, reject) => {
    const f = spawn(ffmpeg, ['-hide_banner', '-list_devices', 'true', '-f', 'dshow', '-i', 'dummy'], { windowsHide: true });
    let saida = '';
    f.stdout.on('data', (d) => { saida += d; });
    f.stderr.on('data', (d) => { saida += d; });
    f.on('error', reject);
    f.on('close', () => resolve(saida));
  });
}

/**
 * Compara a lista do DirectShow com a configuração. Com `parado` não há
 * verificação; com `so-som` a câmera não é verificada; `fonte: teste` ignora.
 */
export function avaliarDispositivos(saida, cfg, estado) {
  const r = { camera: 'ok', microfone: 'ok' };
  if (cfg.fonte === 'teste' || estado === 'parado') return r;
  const lista = parsearDispositivos(saida);
  if (estado !== 'so-som' && !lista.video.includes(cfg.video)) r.camera = 'sumiu';
  if (!lista.audio.includes(cfg.audio)) r.microfone = 'sumiu';
  return r;
}

/** Linha do log do supervisor que indica queda do ffmpeg. */
export function ehFalhaDoFfmpeg(linha) {
  return /ffmpeg(\.exe)?["']? (saiu com código|erro ao executar)/.test(linha);
}

/**
 * Saúde do monitor: câmera e microfone `ok` ou `sumiu`, e `captura` quando o
 * ffmpeg falha seguidas vezes sem causa identificada. Grava `<pasta>/saude.json`
 * (o ROCKY-3 lê), mostra toast (se `toast`) e chama `aoAlerta` uma vez a cada
 * mudança de situação (problema e recuperação) — gancho do ROCKY-6.
 *
 * aoAlerta({ tipo: 'camera'|'microfone'|'captura', problema, mensagem, em })
 */
export function criarSaude({
  cfg, aoAlerta = () => {}, toast = true, log = console.log,
  listar = () => listarAssincrono(cfg.ffmpeg),
  lerEstado = () => {
    try { return JSON.parse(readFileSync(join(cfg.pasta, 'estado.json'), 'utf8')).estado; } catch { return cfg.estadoInicial ?? 'gravando'; }
  },
  relogio = Date.now,
  enviar = enviarToast,
}) {
  const limiteFalhas = cfg.alertaFalhasSeguidas ?? 3;
  const estavelMs = (cfg.alertaEstavelSegundos ?? 120) * 1000;
  const arquivo = join(cfg.pasta, 'saude.json');
  const situacao = { camera: 'ok', microfone: 'ok', captura: 'ok' };
  let falhas = 0;
  let ultimaFalha = 0;
  let fila = Promise.resolve();

  function gravar() {
    try {
      mkdirSync(cfg.pasta, { recursive: true });
      const tmp = `${arquivo}.tmp`;
      writeFileSync(tmp, JSON.stringify({ ...situacao, atualizadoEm: new Date().toISOString() }));
      renameSync(tmp, arquivo);
    } catch (e) { log(`Não consegui gravar saude.json: ${e.message}`); }
  }

  function mudar(tipo, novo) {
    if (situacao[tipo] === novo) return;
    situacao[tipo] = novo;
    const problema = novo !== 'ok';
    const mensagem = TEXTOS[tipo][problema ? 0 : 1];
    const alerta = { tipo, problema, mensagem, em: new Date().toISOString() };
    log(`ALERTA: ${mensagem}`);
    gravar();
    if (toast) enviar(problema ? 'Monitor Rocky: atenção' : 'Monitor Rocky: ok', mensagem).catch(() => {});
    try { aoAlerta(alerta); } catch (e) { log(`Erro no aoAlerta: ${e.message}`); }
  }

  async function verificar() {
    const estado = lerEstado();
    try {
      const r = await listar();
      const saida = typeof r === 'string' ? r : `${r.stderr ?? ''}\n${r.stdout ?? ''}`;
      const a = avaliarDispositivos(saida, cfg, estado);
      mudar('camera', a.camera);
      mudar('microfone', a.microfone);
      if (falhas > 0 && relogio() - ultimaFalha > estavelMs) falhas = 0;
      if (a.camera === 'ok' && a.microfone === 'ok' && falhas === 0) mudar('captura', 'ok');
    } catch (e) { log(`Não consegui listar os dispositivos: ${e.message}`); }
    gravar();
  }

  function registrarLinha(linha) {
    if (!ehFalhaDoFfmpeg(linha)) return;
    const agora = relogio();
    if (agora - ultimaFalha > estavelMs) falhas = 0;
    ultimaFalha = agora;
    falhas += 1;
    if (falhas === limiteFalhas) {
      // descobre a causa: se um dispositivo sumiu, alerta ele; senão, a captura
      fila = fila.then(async () => {
        await verificar();
        if (situacao.camera === 'ok' && situacao.microfone === 'ok') mudar('captura', 'falhando');
      }).catch(() => {});
    }
  }

  return { verificar, registrarLinha, situacao: () => ({ ...situacao }), arquivo, esperar: () => fila };
}

