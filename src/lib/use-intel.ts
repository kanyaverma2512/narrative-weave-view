import { useMemo } from "react";
import { buildSnapshot, type Filters } from "./dataset-analytics";
import type { IntelSnapshot } from "./intel-types";

/**
 * Builds the analytics snapshot from the bundled annotated datasets for the
 * current filter selection. Every view reads from this single derived model.
 */
export function useIntel(filters: Filters): IntelSnapshot {
  return useMemo(() => buildSnapshot(filters), [filters]);
}
