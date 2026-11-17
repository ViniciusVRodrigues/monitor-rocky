import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarScriptToast } from '../src/toast.js';

test('script do toast usa WinRT embutido e escapa aspas e XML', () => {
  const s = montarScriptToast('Câmera sumiu', 'O "Rocky" <1> & \'cia\'', 'Monitor Rocky');
  assert.match(s, /Windows\.UI\.Notifications\.ToastNotificationManager/);
  assert.match(s, /CreateToastNotifier\('Monitor Rocky'\)/);
  assert.ok(!s.includes('<1>'));
  assert.match(s, /&lt;1&gt; &amp;/);
  assert.match(s, /''cia''/);
});
