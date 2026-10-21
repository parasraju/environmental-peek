import type { EnvEntry, FilterOptions } from "./types.js";

export type { FilterOptions };

/**
 * Filter environment entries based on options:
 * - filter: Case-insensitive substring match against key and value.
 * - key: Exact key match.
 * - sensitiveOnly: Only entries marked as sensitive.
 */
export function filterEntries(
  entries: EnvEntry[],
  options: FilterOptions = {}
): EnvEntry[] {
  const { filter, key, sensitiveOnly } = options;
  const filterLower =
    filter !== undefined && filter !== "" ? filter.toLowerCase() : undefined;

  return entries.filter((entry) => {
    if (key !== undefined && entry.key !== key) {
      return false;
    }

    if (sensitiveOnly && !entry.sensitive) {
      return false;
    }

    if (filterLower !== undefined && filterLower !== "") {
      const keyMatches = entry.key.toLowerCase().includes(filterLower);
      const valueMatches = (entry.value ?? "").toLowerCase().includes(filterLower);
      if (!keyMatches && !valueMatches) {
        return false;
      }
    }

    return true;
  });
}
