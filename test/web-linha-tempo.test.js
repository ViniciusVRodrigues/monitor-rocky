import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  segundosDoHorario, segundosDoIso, agruparBlocos, montarLista, nivelIntensidade, posicaoNaRegua,
  larguraNaRegua, formatarHoraMinuto, textoPilula, textoEventos, rotuloDia, vizinhosDoDia, segmentosDaHora,
} from '../web/js/linha-tempo.js';

const t = (inicio, soAudio = false) => ({ inicio, soAudio, url: `/x/${inicio}.mp4` });

test('horários em segundos', () => {
  assert.equal(segundosDoHorario('14:02:30'), 14 * 3600 + 150);
  assert.ok(Number.isNaN(segundosDoHorario('x')));
  assert.equal(segundosDoIso('2026-11-17T14:03:05-03:00'), 14 * 3600 + 185);
  assert.equal(formatarHoraMinuto(14 * 3600 + 185), '14:03');
});

test('agrupa trechos contíguos e separa por tipo e por lacuna', () => {
  const b = agruparBlocos([t('14:02:00'), t('14:03:00'), t('14:04:04'), t('14:10:00'), t('14:11:00', true), t('14:12:00', true)], 60);
  assert.equal(b.length, 3);
  assert.deepEqual(b[0].indices, [0, 1, 2]); // 14:04:04 está dentro dos 5 s de folga
  assert.equal(b[0].inicio, 14 * 3600 + 120);
  assert.equal(b[0].fim, 14 * 3600 + 4 * 60 + 4 + 60);
  assert.equal(b[1].soAudio, false);
  assert.equal(b[2].soAudio, true);
  assert.equal(b[2].trechos.length, 2);
});

test('lacuna maior que trechoSegundos + 5 quebra o bloco', () => {
  assert.equal(agruparBlocos([t('10:00:00'), t('10:01:06')], 60).length, 2);
  assert.equal(agruparBlocos([t('10:00:00'), t('10:01:05')], 60).length, 1);
});

test('bloco não atravessa a virada de hora', () => {
  const b = agruparBlocos([t('13:59:00'), t('14:00:00')], 60);
  assert.equal(b.length, 2);
  assert.deepEqual(b.map((x) => x.hora), [13, 14]);
});

test('montarLista recolhe horas vazias e ordena da mais recente', () => {
  const l = montarLista({
    trechos: [t('14:02:00'), t('11:00:00')],
    eventos: [{ id: 'a', inicio: '2026-11-17T14:03:05-03:00', intensidade: 0.5 }],
    trechoSegundos: 60, ate: 16,
  });
  assert.deepEqual(l.map((i) => (i.tipo === 'hora' ? i.hora : i.rotulo)), [
    '15h–16h · sem gravação', 14, '12h–13h · sem gravação', 11, '00h–10h · sem gravação',
  ]);
  assert.equal(l[1].eventos.length, 1);
});

test('faixa vazia de uma hora só e dia todo vazio', () => {
  const l = montarLista({ trechos: [t('05:00:00')], eventos: [], trechoSegundos: 60, ate: 6 });
  assert.equal(l[0].rotulo, '06h · sem gravação');
  assert.equal(l[2].rotulo, '00h–04h · sem gravação');
  assert.equal(montarLista({ trechos: [], eventos: [], trechoSegundos: 60, ate: 23 }).length, 1);
});

test('hora só com evento (trechos apagados) aparece sem blocos', () => {
  const l = montarLista({ trechos: [], eventos: [{ id: 'a', inicio: '2026-11-17T03:10:00-03:00' }], trechoSegundos: 60, ate: 4 });
  const h = l.find((i) => i.tipo === 'hora');
  assert.equal(h.hora, 3);
  assert.equal(h.blocos.length, 0);
});

test('intensidade em três níveis', () => {
  assert.equal(nivelIntensidade(0), 'fraca');
  assert.equal(nivelIntensidade(0.33), 'fraca');
  assert.equal(nivelIntensidade(0.34), 'média');
  assert.equal(nivelIntensidade(0.66), 'média');
  assert.equal(nivelIntensidade(0.67), 'forte');
  assert.equal(nivelIntensidade(1), 'forte');
  assert.equal(nivelIntensidade('x'), 'fraca');
});

test('posição e largura na régua de 24 h', () => {
  assert.equal(posicaoNaRegua(43200), 50);
  assert.equal(posicaoNaRegua(-5), 0);
  assert.equal(posicaoNaRegua(99999), 100);
  assert.equal(larguraNaRegua(86400 - 30, 60), (30 / 86400) * 100);
});

test('mini-régua da hora', () => {
  const b = agruparBlocos([t('14:30:00')], 60);
  const [s] = segmentosDaHora(b, 14);
  assert.equal(s.de, 50);
  assert.equal(Math.round(s.para), 52);
});

test('textos', () => {
  assert.equal(textoPilula(1), '1 evento novo · ver');
  assert.equal(textoPilula(2), '2 eventos novos · ver');
  assert.equal(textoEventos(1), '1 evento');
  assert.equal(textoEventos(3), '3 eventos');
  assert.equal(rotuloDia('2026-11-17', '2026-11-17'), 'Hoje, 17/11');
  assert.equal(rotuloDia('2026-11-16', '2026-11-17'), 'Seg, 16/11');
});

test('vizinhos de dia (lista decrescente)', () => {
  const dias = ['2026-11-17', '2026-11-16', '2026-11-14'];
  assert.deepEqual(vizinhosDoDia(dias, '2026-11-16'), { anterior: '2026-11-14', proximo: '2026-11-17' });
  assert.deepEqual(vizinhosDoDia(dias, '2026-11-17'), { anterior: '2026-11-16', proximo: null });
  assert.deepEqual(vizinhosDoDia(dias, 'x'), { anterior: null, proximo: null });
});
