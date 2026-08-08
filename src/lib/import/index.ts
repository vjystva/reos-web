/**
 * Registry of importable entities for `/dashboard/import`.
 *
 * Order here is the order of the entity picker. `leads` is FIRST and is the
 * default so the page keeps behaving exactly as it did when it was
 * leads-only — anything linking to `/dashboard/import` lands on the same
 * screen it always did.
 *
 * Adding an entity is: write a config module, add it here. The page, the
 * mapping panel, the preview table and the result card need no changes.
 */

import { bookingsImportConfig } from "./bookings";
import { dealersImportConfig } from "./dealers";
import { leadsImportConfig } from "./leads";
import { tasksImportConfig } from "./tasks";
import { unitsImportConfig } from "./units";
import type { EntityImportConfig, ImportEntityKey } from "./types";

export const IMPORT_ENTITIES: EntityImportConfig[] = [
  leadsImportConfig,
  unitsImportConfig,
  dealersImportConfig,
  bookingsImportConfig,
  tasksImportConfig,
];

export const DEFAULT_IMPORT_ENTITY: ImportEntityKey = "leads";

const BY_KEY = new Map<ImportEntityKey, EntityImportConfig>(
  IMPORT_ENTITIES.map((c) => [c.key, c]),
);

export function getImportConfig(key: ImportEntityKey): EntityImportConfig {
  const config = BY_KEY.get(key);
  if (!config) throw new Error(`unknown_import_entity_${key}`);
  return config;
}

/** Narrowing helper for values arriving from the URL / a <select>. */
export function isImportEntityKey(value: string): value is ImportEntityKey {
  return BY_KEY.has(value as ImportEntityKey);
}

export {
  bookingsImportConfig,
  dealersImportConfig,
  leadsImportConfig,
  tasksImportConfig,
  unitsImportConfig,
};
export * from "./stage";
export * from "./types";
