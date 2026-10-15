# Appartement Jacques Kablé — Strasbourg

Site Astro statique, direction B : anthracite, tons chauds, grandes photographies.
Prix : **630 000 €**. Surface habitable : **92,35 m²**. Terrasse : **152 m²**.

Les sources et les médias sont autonomes dans ce dépôt. Aucun asset n’est chargé
depuis le site de l’agence, Google Fonts ou un service cartographique distant.

## Démarrer

Node.js 22.12 ou ultérieur est nécessaire.

```powershell
npm ci
npm run check
npm test
npm run build
npm run preview
```

L'aperçu est accessible sur **http://127.0.0.1:4371/**. Il écoute seulement sur la
machine locale. Le dossier `dist` contient les fichiers statiques générés.
Pour développer, `npm run dev -- --background` suit le mode serveur de la version
Astro installée ; arrêt avec `npm run astro -- dev stop`.

## Contenu livré

- Page principale française, responsive, avec les informations essentielles en tête.
- 23 photos distinctes locales, AVIF/WebP/JPEG responsive, sans agrandissement artificiel.
- Galerie clavier/tactile avec dialogue natif, Échap et retour du focus ; liens
  vers les images utilisables sans JavaScript.
- Carte locale exacte du quartier, variantes bureau/mobile, attribution OSM et lien
  d'exploration. Aucun marqueur d'immeuble, SDK cartographique ou chargement de tuiles.
- Pages mentions légales et confidentialité, 404, métadonnées et données structurées,
  sitemap et robots adaptés au mode de publication.
- Polices WOFF2 locales et licences OFL. Aucun formulaire, analytics, cookie ou stockage local.

## Ce qui reste à fournir avant publication

`site.config.json` regroupe les coordonnées et les autorisations de mise en ligne.
Les champs vides ne sont **pas** remplacés par des données inventées.

1. Renseigner `contactEmail` et `contactPhone` : les véritables liens e-mail/téléphone
   deviennent disponibles après reconstruction.
2. Renseigner le domaine HTTPS réel dans `siteUrl`, à la racine et sans chemin.
3. Finaliser `editorLegalNotice`, `hostName`, `hostAddress`, `hostUrl` et `privacyNotice`.
   Adapter les mentions au régime d'un éditeur particulier, sans publier par défaut
   l'adresse précise du logement. La confidentialité doit expliquer les demandes
   e-mail/téléphone, leurs finalités, base applicable, destinataires, conservation et droits.
4. Renseigner `energyConsumption` et `greenhouseEmissions` depuis le DPE réel.
   Renseigner séparément `verifiedChargesMonthly` et `verifiedAnnualBudgetShare` :
   ne pas additionner les charges mensuelles et la quote-part annuelle, ni déduire
   mécaniquement l’un de l’autre. Les valeurs sources restent visibles en aperçu.
   Renseigner `propertyTaxYear` depuis l’avis de taxe foncière.
   Renseigner `coownershipProceedings` avec `none` (absence confirmée) ou `ongoing`
   (procédures en cours), et dans ce dernier cas `coownershipProceedingsDetails`.
5. Relire `src/data/property.ts` et les textes : surfaces, classes DPE/GES, énergie,
   charges de 340 €/mois et quote-part de 4 100 €/an, taxe foncière/millésime, lots et procédures.
   Si une donnée source est corrigée, modifier également sa formulation dans la page.
6. Après vérification documentaire et juridique, confirmer `informationVerified`.
   Confirmer `mandateCleared` seulement après vérification du terme effectif du mandat
   et des clauses applicables aux acquéreurs éventuellement présentés par l'agence.
7. Autoriser explicitement la publication avec `allowPublication`.

Le build normal reste toujours un **aperçu non indexable**. Il ne constitue pas une
protection d'accès : ne pas héberger un aperçu contenant des informations privées
sur une URL publique sans authentification.

Pour produire une version publique :

```powershell
npm run build:release
```

La commande échoue explicitement tant que les informations et confirmations
indispensables manquent. Elle ne déploie rien. Après réussite, publier `dist-release` sur
l'hébergement choisi, en HTTPS, puis contrôler les liens et demander l'indexation
dans Search Console. Aucun classement ou résultat enrichi Google n'est garanti.
`npm run build` impose le mode aperçu même si l’environnement contient
`SITE_MODE=release`. Il ne touche pas à la configuration et produit seulement `dist`.
Une tentative release invalide supprime l’ancien `dist-release`, jamais l’aperçu `dist`.
Ne pas utiliser directement `astro build` pour préparer une livraison.

## Vérifier

```powershell
npm test
npm run check
npm run build
npm run test:release
npm run preview
# Dans un autre terminal :
python tests\browser.py
```

La recette navigateur nécessite Python avec Playwright/Chromium disponibles
(`python -m pip install playwright`, puis `python -m playwright install chromium`
si nécessaire). Elle écrit captures et rapport sous `verification`, ignoré par Git.
Le test `test:release` construit de vraies versions à partir de données fictives
dans un répertoire temporaire isolé, non servi, puis le supprime. Il ne modifie
jamais la configuration active. Il vérifie aussi le rejet d’une release incomplète,
l’activation indépendante des contacts et le retour forcé en mode aperçu.

### Recette de cette livraison

Le 14 octobre 2026 : 10 tests unitaires réussis ; contrôle Astro sans erreur,
avertissement ni hint ; builds preview et release isolée réussis. La configuration
livrée est bien refusée par `npm run build:release` (code 1).

La recette navigateur couvre 320/360/390/768/1024/1440 px, zoom CSS 200 % et
viewport équivalent, clavier/retour du focus/tactile, 23 photos, 28 liens internes,
repli sans JavaScript et carte locale. Aucun débordement, aucune violation axe
détectée sur les deux tailles auditées, aucune erreur JavaScript ni requête externe.
Les grands JPEG ne sont pas téléchargés avant une ouverture volontaire.

Dernier audit Lighthouse 13.5.0 mobile sur localhost : performance **93/100**,
accessibilité **100**, bonnes pratiques **100** ; LCP **3,04 s**, CLS **0,038**,
TBT **75 ms**, environ **434 Kio** transférés. Le SEO de l’aperçu est **66** à
cause des protections d’indexation volontairement maintenues. Le LCP de laboratoire
reste supérieur à la cible terrain de 2,5 s : ce résultat sur une machine partagée
n’est pas une mesure terrain, ni une mesure INP, ni une garantie de classement.
Rapports HTML/JSON et captures : `verification` et dossier de livraison.

## Fichiers utiles

- `src/pages/index.astro` : composition et textes de la page.
- `src/data/property.ts` et `site.config.json` : faits du bien et réglages de publication.
- `src/data/photos.json` : ordre, titres et descriptions factuelles.
- `src/styles/site.css` : identité visuelle B.
- `src/components/LocationMap.astro` : carte et confidentialité de localisation.
- `src/scripts/gallery.ts` : interactions de la galerie.
- `scripts/publication.mjs` : contrôle de publication partagé avec la configuration Astro.
- `tests/publication.test.mjs` : contrôles de configuration et d'intégrité des médias.
- `tests/release-build.test.mjs` : builds preview/release isolés avec fixtures de test.
- `tests/browser.py` : parcours navigateur et audit axe, à lancer sur l'aperçu local.

## Sources et droits

Photos issues de l'annonce VA3044 de l'agence Gaël Sturtz, réutilisation autorisée
par le propriétaire. Filigranes conservés ; métadonnées privées non recopiées.
Aucune coordonnée de l'agence n'est utilisée pour les demandes de visite.

Carte : © les contributeurs OpenStreetMap, ODbL. Voir `public/maps/CREDITS.txt` et
`public/maps/source-osm.json`. Le générateur reproductible et les données minimales
figurent dans `tools/cartographie` ; `python generer-carte.py` y reconstruit les SVG
sans requête réseau. Les cadrages utilisent le quartier public, pas la position du bien.

Polices : Cormorant Garamond, Manrope et Tenor Sans. Licences dans `public/fonts/OFL-*.txt`.
Les WOFF2 contiennent le latin occidental et français, le symbole euro et les signes
utilisés dans les diagnostics. Cormorant conserve les graisses 400–500 réellement
utilisées ; les fichiers complets et leurs licences restent disponibles dans les
artefacts de conception du propriétaire.

Les SVG optimisés doivent rester locaux ; ne pas remplacer la carte par un
chargement de tuiles distant ou par un repère précis sans une nouvelle décision du propriétaire.
