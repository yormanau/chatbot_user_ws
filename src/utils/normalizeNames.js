function normalizeNames(fullName) {
  if (!fullName || typeof fullName !== 'string') return fullName;

  const lowerWords = ['de', 'del', 'la', 'los', 'las'];

  return fullName
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map(word => {
      if (lowerWords.includes(word)) return word;
      return word.charAt(0).toLocaleUpperCase('es-CO') + word.slice(1);
    })
    .join(' ');
}

module.exports = { normalizeNames };