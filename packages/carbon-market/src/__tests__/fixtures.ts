/**
 * Sample Verra registry payloads modelled on the public registry's JSON
 * shapes (https://registry.verra.org/uiapi/). These are minimal but
 * structurally faithful — the schemas accept passthrough so adding
 * fields here won't break the parse.
 */

export const SAMPLE_PROJECT_LIST = Object.freeze({
  projects: [
    {
      id: 1234,                                 // Verra often returns numeric IDs
      name: 'Kasigau Corridor REDD+ Project',
      country: 'KE',
      methodology: 'VM0009',
      projectType: 'AFOLU',
      status: 'Registered',
      proponent: 'Wildlife Works',
      registryUrl: 'https://registry.verra.org/app/projectDetail/VCS/1234',
      lastIssuanceDate: '2025-09-10',
      totalIssuedTonnes: 1_250_000,
    },
    {
      id: '5678',
      name: 'Tanzania Cookstoves Programme',
      country: 'TZ',
      methodology: 'AMS-II.G',
      projectType: 'Energy efficiency',
      status: 'Registered',
      proponent: 'Hadithi Carbon Ltd',
      registryUrl: 'https://registry.verra.org/app/projectDetail/VCS/5678',
      lastIssuanceDate: '2025-12-01',
      totalIssuedTonnes: 84_000,
    },
    {
      id: '9012',
      name: 'Uganda Biochar Sequestration',
      country: 'UG',
      methodology: 'VM0044',
      projectType: 'Removal — Biochar',
      status: 'Registered',
      proponent: 'Nile Carbon Removals',
      lastIssuanceDate: '2026-03-15',
      totalIssuedTonnes: 12_000,
    },
  ],
});

export const SAMPLE_ISSUANCE_LIST = Object.freeze({
  issuances: [
    {
      projectId: '1234',
      serialNumber: '1234-VCS-2024-AB-0001-0000010000',
      vintage: 2024,
      tonnes: 10_000,
      issuanceDate: '2025-09-10',
      retired: false,
    },
    {
      projectId: '5678',
      serialNumber: '5678-VCS-2024-CD-0001-0000005000',
      vintage: 2024,
      tonnes: 5_000,
      issuanceDate: '2025-12-01',
      retired: true,
    },
  ],
});

export const SAMPLE_SINGLE_PROJECT = Object.freeze({
  id: '9012',
  name: 'Uganda Biochar Sequestration',
  country: 'UG',
  methodology: 'VM0044',
  projectType: 'Removal — Biochar',
  status: 'Registered',
  proponent: 'Nile Carbon Removals',
  lastIssuanceDate: '2026-03-15',
  totalIssuedTonnes: 12_000,
});

/** Malformed payload — `id` numeric is fine but `country` is wrong length. */
export const MALFORMED_PROJECT_LIST = Object.freeze({
  projects: [
    {
      id: 99,
      name: 'Bad Country Code Project',
      country: 'KEN',                         // ISO-alpha-3 instead of -2
      methodology: 'VM0007',
      projectType: 'AFOLU',
      status: 'Registered',
    },
  ],
});

/** Toucan-shaped token metadata. */
export const SAMPLE_TOUCAN_METADATA = Object.freeze({
  serialNumber: '1234-VCS-2024-AB-0001-0000010000',
  projectId: 1234,
  vintage: 2024,
  issuer: 'Toucan',
});
