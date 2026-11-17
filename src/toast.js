import { spawn } from 'node:child_process';

const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ps = (s) => String(s).replace(/'/g, "''");

/**
 * Script PowerShell de um toast do Windows, sem módulo nenhum: usa o WinRT
 * embutido (ToastNotificationManager). `app` é o nome que aparece no toast.
 */
export function montarScriptToast(titulo, texto, app = 'Monitor Rocky') {
  const corpo = `<toast><visual><binding template="ToastGeneric"><text>${xml(titulo)}</text><text>${xml(texto)}</text></binding></visual></toast>`;
  return [
    "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null",
    "[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null",
    "$x = New-Object Windows.Data.Xml.Dom.XmlDocument",
    `$x.LoadXml('${ps(corpo)}')`,
    `[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('${ps(app)}').Show([Windows.UI.Notifications.ToastNotification]::new($x))`,
  ].join('\n');
}

/** Mostra o toast; só no Windows; nunca lança (devolve false se falhar). */
export function enviarToast(titulo, texto, { app = 'Monitor Rocky', iniciar = spawn } = {}) {
  if (process.platform !== 'win32') return Promise.resolve(false);
  return new Promise((resolve) => {
    try {
      const cod = Buffer.from(montarScriptToast(titulo, texto, app), 'utf16le').toString('base64');
      const f = iniciar('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-EncodedCommand', cod],
        { stdio: 'ignore', windowsHide: true });
      f.on('error', () => resolve(false));
      f.on('exit', (c) => resolve(c === 0));
    } catch { resolve(false); }
  });
}
