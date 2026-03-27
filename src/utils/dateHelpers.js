/**
 * formatDateToDisplay — Convierte una fecha SQL a DD/MM/YYYY.
 * Usa UTC para evitar desfase por timezone del servidor.
 *
 * @param {string|Date} date — Fecha en formato SQL "YYYY-MM-DD" o Date object
 * @returns {string|null}    — "DD/MM/YYYY" o null si no hay fecha
 */
function formatDateToDisplay(date) {
  if (!date) return null;
  const d    = new Date(date);
  const dd   = String(d.getUTCDate()).padStart(2, '0');
  const mm   = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * formatDateToSQL — Convierte DD/MM/YYYY a YYYY-MM-DD para MySQL.
 *
 * @param {string} date — Fecha en formato "DD/MM/YYYY"
 * @returns {string|null} — "YYYY-MM-DD" o null si no hay fecha
 */
function formatDateToSQL(date) {
  if (!date) return null;
  const [dd, mm, yyyy] = date.split('/');
  if (!dd || !mm || !yyyy) return null;
  return `${yyyy}-${mm}-${dd}`;
}

module.exports = { formatDateToDisplay, formatDateToSQL };