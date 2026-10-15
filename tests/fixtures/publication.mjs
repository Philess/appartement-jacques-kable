// Données fictives exclusivement réservées aux tests ; jamais servies ni publiées.
export const ready = {
  allowPublication: true, informationVerified: true, mandateCleared: true,
  siteUrl: 'https://validation-vente-fixture.fr/',
  basePath: '/',
  contactEmail: 'vendeur@validation-vente-fixture.fr',
  contactPhone: '+33 6 39 98 00 00',
  editorLegalNotice: 'Mentions complètes validées dans une fixture isolée.',
  hostName: 'Hébergeur de la fixture', hostAddress: 'Adresse de la fixture',
  hostUrl: 'https://hebergeur-fixture.fr/',
  privacyNotice: 'Finalités, base, conservation, destinataires et droits de la fixture.',
  energyConsumption: 95, greenhouseEmissions: 3,
  verifiedChargesMonthly: 340, verifiedAnnualBudgetShare: 4100,
  propertyTaxYear: 2025, coownershipProceedings: 'none', coownershipProceedingsDetails: '',
};

export const unconfigured = {
  ...ready,
  allowPublication: false, informationVerified: false, mandateCleared: false,
  siteUrl: '', basePath: '/', contactEmail: '', contactPhone: '',
  editorLegalNotice: '', hostName: '', hostAddress: '', hostUrl: '', privacyNotice: '',
  energyConsumption: null, greenhouseEmissions: null,
  verifiedChargesMonthly: null, verifiedAnnualBudgetShare: null,
  propertyTaxYear: null, coownershipProceedings: '', coownershipProceedingsDetails: '',
};
