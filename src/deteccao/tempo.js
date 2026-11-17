const p2 = (n) => String(n).padStart(2, '0');

/** AAAA-MM-DD na hora local. */
export function nomeDia(d) {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

/** HH-MM-SS na hora local. */
export function nomeHora(d) {
  return `${p2(d.getHours())}-${p2(d.getMinutes())}-${p2(d.getSeconds())}`;
}

/** ISO em hora local com fuso, sem milissegundos: 2026-11-17T14:03:05-03:00. */
export function isoLocal(d) {
  const off = -d.getTimezoneOffset();
  const sinal = off >= 0 ? '+' : '-';
  const abs = Math.abs(off);
  return `${nomeDia(d)}T${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}` +
    `${sinal}${p2(Math.floor(abs / 60))}:${p2(abs % 60)}`;
}
