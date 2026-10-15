import { isIP } from 'node:net';

/** @param {unknown} value */
export function validEmail(value) {
  return typeof value === 'string' && /^[^\s@<>?&#]+@[^\s@<>?&#]+\.[^\s@<>?&#]+$/.test(value.trim()) &&
    !/@(example\.(com|org|net)|[^@]+\.(test|invalid))$/i.test(value.trim());
}

/** @param {unknown} value */
export function validPhone(value) {
  return typeof value === 'string' && /^\+?[0-9 ()-]{9,22}$/.test(value.trim()) &&
    value.replace(/\D/g, '').length >= 9 && value.replace(/\D/g, '').length <= 15;
}

/** @param {unknown} candidate */
export function publicationErrors(candidate) {
  if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
    return ['La configuration doit être un objet JSON.'];
  }
  const config = /** @type {Record<string, unknown>} */ (candidate);
  /** @type {string[]} */
  const errors = [];
  const text = (/** @type {string} */ key) =>
    typeof config[key] === 'string' ? config[key].trim() : '';
  for (const [key, label] of [
    ['allowPublication', 'Autorisation explicite de publication'],
    ['informationVerified', 'Confirmation des informations, diagnostics et mentions légales'],
    ['mandateCleared', 'Confirmation de la vente directe et des clauses du mandat'],
  ]) {
    if (config[key] !== true) errors.push(`${label} manquante.`);
  }
  const site = text('siteUrl');
  try {
    const url = new URL(site);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
        url.pathname !== '/' || url.port || !url.hostname.includes('.') || isIP(url.hostname.replace(/^\[|\]$/g, '')) !== 0 ||
        /(^localhost$|:|\.(local|localhost|lan|internal|test|invalid|example)$|(^|\.)example\.(com|org|net)$)/i.test(url.hostname)) {
      errors.push('siteUrl doit être le domaine HTTPS public réel, sans chemin ni identifiants.');
    }
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    errors.push('siteUrl doit contenir une URL HTTPS publique valide.');
  }
  if (!validEmail(text('contactEmail'))) {
    errors.push('Adresse e-mail réelle du vendeur manquante ou invalide.');
  }
  if (!validPhone(text('contactPhone'))) {
    errors.push('Numéro de téléphone du vendeur manquant ou invalide.');
  }
  for (const key of ['editorLegalNotice', 'hostName', 'hostAddress', 'hostUrl', 'privacyNotice']) {
    if (!text(key) || /à renseigner|à compléter|todo|placeholder/i.test(text(key))) {
      errors.push(`${key} doit être renseigné avec les informations définitives.`);
    }
  }
  try {
    const hostUrl = new URL(text('hostUrl'));
    if (hostUrl.protocol !== 'https:' || hostUrl.username || hostUrl.password) errors.push('hostUrl doit être une URL HTTPS valide.');
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    errors.push('hostUrl doit être une URL HTTPS valide.');
  }
  for (const key of ['energyConsumption', 'greenhouseEmissions', 'verifiedChargesMonthly', 'verifiedAnnualBudgetShare']) {
    if (typeof config[key] !== 'number' || !Number.isFinite(config[key]) || config[key] < 0) {
      errors.push(`${key} doit reprendre une valeur chiffrée vérifiée dans les justificatifs.`);
    }
  }
  if (typeof config.propertyTaxYear !== 'number' || !Number.isInteger(config.propertyTaxYear) ||
      config.propertyTaxYear < 2000 || config.propertyTaxYear > new Date().getFullYear()) {
    errors.push('propertyTaxYear : millésime réel de la taxe foncière requis.');
  }
  if (!['none', 'ongoing'].includes(text('coownershipProceedings'))) {
    errors.push('coownershipProceedings : situation vérifiée requise (none ou ongoing).');
  } else if (text('coownershipProceedings') === 'ongoing' && !text('coownershipProceedingsDetails')) {
    errors.push('coownershipProceedingsDetails : préciser les procédures en cours.');
  }
  return errors;
}
