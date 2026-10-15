import settings from '../../site.config.json';

export const config = settings;
export const released = __SITE_RELEASE__;
export const property = {
  price: 630000,
  currency: 'EUR',
  surface: 92.35,
  terrace: 152,
  livingArea: 42,
  rooms: 4,
  bedrooms: 3,
  floor: 9,
  floors: 15,
  construction: 2019,
  city: 'Strasbourg',
  postalCode: '67000',
  district: 'Jacques Kablé',
  energyClass: 'B',
  climateClass: 'A',
  energyCost: { min: 720, max: 1030, reference: '2021, 2022 et 2023' },
  chargesMonthly: config.verifiedChargesMonthly ?? 340,
  annualBudgetShare: config.verifiedAnnualBudgetShare ?? 4100,
  propertyTax: 2143,
  condominiumLots: 249,
} as const;
export const price = new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: property.currency, maximumFractionDigits: 0,
}).format(property.price);
export const title = 'Appartement à vendre à Strasbourg | Terrasse de 152 m²';
export const description = 'Strasbourg, Jacques Kablé : appartement T4 de 92,35 m², terrasse arborée de 152 m², vue cathédrale, 3 chambres et double garage. Vente directe : 630 000 €.';
export const mapUrl = 'https://www.openstreetmap.org/#map=15/48.5932/7.7530';
