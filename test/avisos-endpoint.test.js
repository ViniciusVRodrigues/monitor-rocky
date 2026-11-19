import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { endpointPermitido, validarInscricao } from '../src/avisos/endpoint.js';

const HOSTS = ['fcm.googleapis.com', 'web.push.apple.com', 'push.services.mozilla.com', 'notify.windows.com'];
const b64u = (b) => b.toString('base64url');
const p256dh = () => b64u(Buffer.concat([Buffer.from([4]), randomBytes(64)]));
const auth = () => b64u(randomBytes(16));

test('endpointPermitido aceita host igual ou subdomínio, só https', () => {
  assert.equal(endpointPermitido('https://fcm.googleapis.com/fcm/send/abc', HOSTS), true);
  assert.equal(endpointPermitido('https://x.notify.windows.com/w/?token=1', HOSTS), true);
  assert.equal(endpointPermitido('https://updates.push.services.mozilla.com/wpush/v2/x', HOSTS), true);
  assert.equal(endpointPermitido('https://FCM.GoogleAPIs.com/x', HOSTS), true);
  assert.equal(endpointPermitido('https://fcm.googleapis.com:443/x', HOSTS), true);
});

test('endpointPermitido recusa o que não é da lista', () => {
  for (const u of [
    'http://fcm.googleapis.com/x',
    'https://evilfcm.googleapis.com.evil.com/x',
    'https://fcm.googleapis.com.evil/x',
    'https://evilnotify.windows.com/x',
    'https://notify.windows.com@evil.com/x',
    'https://user:pw@fcm.googleapis.com/x',
    'https://fcm.googleapis.com:8443/x',
    'https://127.0.0.1/x',
    'ftp://fcm.googleapis.com/x',
    'nada', '', null, 5, undefined,
  ]) assert.equal(endpointPermitido(u, HOSTS), false, String(u));
});

test('validarInscricao devolve só endpoint e keys', () => {
  const corpo = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', expirationTime: null, extra: 1, keys: { p256dh: p256dh(), auth: auth(), x: 1 } };
  const r = validarInscricao(corpo, HOSTS);
  assert.deepEqual(Object.keys(r).sort(), ['endpoint', 'keys']);
  assert.deepEqual(Object.keys(r.keys).sort(), ['auth', 'p256dh']);
  assert.equal(r.endpoint, corpo.endpoint);
});

test('validarInscricao lança 400 para corpo ruim', () => {
  const ok = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: p256dh(), auth: auth() } };
  const ruins = [
    null, [], 'x', {},
    { ...ok, endpoint: 5 },
    { ...ok, endpoint: 'http://fcm.googleapis.com/x' },
    { ...ok, endpoint: 'https://evil.example/x' },
    { ...ok, endpoint: 'https://fcm.googleapis.com/' + 'a'.repeat(2100) },
    { ...ok, keys: null },
    { ...ok, keys: { auth: auth() } },
    { ...ok, keys: { p256dh: p256dh() } },
    { ...ok, keys: { p256dh: b64u(Buffer.concat([Buffer.from([5]), randomBytes(64)])), auth: auth() } }, // não começa com 0x04
    { ...ok, keys: { p256dh: b64u(Buffer.concat([Buffer.from([4]), randomBytes(10)])), auth: auth() } },
    { ...ok, keys: { p256dh: p256dh(), auth: b64u(randomBytes(8)) } },
    { ...ok, keys: { p256dh: p256dh(), auth: 'a+b/==' } },
    { ...ok, keys: { p256dh: 5, auth: auth() } },
  ];
  for (const c of ruins) {
    try { validarInscricao(c, HOSTS); } catch (e) { assert.equal(e.status, 400); continue; }
    assert.fail('aceitou ' + JSON.stringify(c).slice(0, 80));
  }
});
