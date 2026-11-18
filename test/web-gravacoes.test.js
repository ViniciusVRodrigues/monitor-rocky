import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  textoConfirmaItem, textoConfirmaHora, textoConfirmaPasta, urlsGuardadas,
  estaGuardado, temGuardado, cruza, notaGuardado, textoParcial,
  anuncioItemApagado, anuncioHoraApagada, anuncioPastaApagada, anuncioGuardado, textoFalhaApagar,
} from '../web/js/gravacoes.js';

test('confirmação do item', () => {
  assert.equal(textoConfirmaItem('Movimento', '16:04'), 'Apagar o clipe de Movimento das 16:04? Não dá para desfazer.');
});

test('confirmação da hora: clipes e gravação, singular e plural', () => {
  assert.equal(textoConfirmaHora({ hora: '16h', clipes: 5, trechos: 12 }), 'Apagar 5 clipes e 12 trechos das 16h? Não dá para desfazer.');
  assert.equal(textoConfirmaHora({ hora: '16h', clipes: 1, trechos: 1 }), 'Apagar 1 clipe e 1 trecho das 16h? Não dá para desfazer.');
  assert.equal(textoConfirmaHora({ hora: '16h', clipes: 7, trechos: 0 }), 'Apagar 7 clipes das 16h? Não dá para desfazer.');
  assert.equal(textoConfirmaHora({ hora: '16h', clipes: 0, trechos: 12 }), 'Apagar 12 trechos das 16h? Não dá para desfazer.');
  assert.match(textoConfirmaHora({ hora: '16h', clipes: 2, trechos: 3, comGuardado: true }), / Não dá para desfazer\. O que está em Guardados continua\.$/);
});

test('confirmação da pasta', () => {
  assert.equal(textoConfirmaPasta('2026-11-17-rocky', 14), 'Apagar a pasta 2026-11-17-rocky com 14 trechos? Não dá para desfazer.');
  assert.equal(textoConfirmaPasta('x', 1), 'Apagar a pasta x com 1 trecho? Não dá para desfazer.');
});

test('urls guardadas, estaGuardado e temGuardado', () => {
  const set = urlsGuardadas([{ origens: ['/arquivos/clipes/a.mp4', '/arquivos/trechos/1.mp4'] }, { origens: [] }, {}]);
  assert.equal(set.size, 2);
  assert.equal(estaGuardado(['/arquivos/clipes/a.mp4'], set), true);
  assert.equal(estaGuardado(['/arquivos/trechos/1.mp4', '/arquivos/trechos/2.mp4'], set), false);
  assert.equal(estaGuardado([], set), false);
  assert.equal(temGuardado(['/x', '/arquivos/trechos/1.mp4'], set), true);
  assert.equal(temGuardado(['/x'], set), false);
});

test('cruza: dois conjuntos de urls', () => {
  assert.equal(cruza(['a', 'b'], ['b', 'c']), true);
  assert.equal(cruza(['a'], ['c']), false);
  assert.equal(cruza([], ['c']), false);
  assert.equal(cruza(['a'], new Set(['a'])), true);
});

test('nota do guardado', () => {
  const v = { url: 'u', soAudio: false };
  const s = { url: 'u', soAudio: true };
  assert.equal(notaGuardado({ arquivos: Array(14).fill(v) }, 60), '14 trechos · 14 min · com vídeo');
  assert.equal(notaGuardado({ arquivos: [s, s] }, 60), '2 trechos · 2 min · só som');
  assert.equal(notaGuardado({ arquivos: [v] }, 60), '1 trecho · 1 min · com vídeo');
  assert.equal(notaGuardado({ arquivos: [] }, 60), '0 trechos');
  assert.equal(notaGuardado({ arquivos: [v], origens: ['/arquivos/clipes/2026-11-17/a.mp4'] }, 60), '1 clipe · com vídeo');
  assert.equal(notaGuardado({ arquivos: [v], origens: ['/arquivos/trechos/2026-11-17/a.mp4'] }, 60), '1 trecho · 1 min · com vídeo');
});

test('resultado parcial e falha', () => {
  assert.equal(textoParcial(5, 2), 'Apaguei 5 de 7. 2 não deu para apagar.');
  assert.equal(textoParcial(0, 3), 'Apaguei 0 de 3. 3 não deu para apagar.');
  assert.equal(textoFalhaApagar(), 'Não consegui apagar. Nada foi apagado.');
  assert.equal(textoFalhaApagar('Esse evento não existe mais.'), 'Esse evento não existe mais.');
});

test('anúncios', () => {
  assert.equal(anuncioItemApagado('16:04'), 'Clipe das 16:04 apagado.');
  assert.equal(anuncioHoraApagada({ hora: '16h', clipes: 7 }), '7 clipes das 16h apagados.');
  assert.equal(anuncioHoraApagada({ hora: '16h', clipes: 1 }), '1 clipe das 16h apagado.');
  assert.equal(anuncioHoraApagada({ hora: '16h', clipes: 0 }), 'Gravação das 16h apagada.');
  assert.equal(anuncioPastaApagada('x'), 'Pasta x apagada.');
  assert.equal(anuncioGuardado('Clipe das 16:04'), 'Clipe das 16:04 guardado em Guardados.');
});
