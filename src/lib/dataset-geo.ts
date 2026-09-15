/**
 * Location fields in the datasets are place names, not coordinates.
 * This map only translates the place names that actually occur in the data
 * into map coordinates. Anything else stays unmapped rather than guessed.
 */
export type GeoPoint = { city: string; state: string; lon: number; lat: number };

const MAP: Record<string, GeoPoint | null> = {
  delhi: { city: "New Delhi", state: "Delhi", lon: 77.21, lat: 28.61 },
  "new delhi": { city: "New Delhi", state: "Delhi", lon: 77.21, lat: 28.61 },
  janpath: { city: "New Delhi", state: "Delhi", lon: 77.21, lat: 28.61 },
  "jantar mantar, delhi": { city: "New Delhi", state: "Delhi", lon: 77.21, lat: 28.61 },
  mumbai: { city: "Mumbai", state: "Maharashtra", lon: 72.88, lat: 19.08 },
  hyderabad: { city: "Hyderabad", state: "Telangana", lon: 78.49, lat: 17.39 },
  amritsar: { city: "Amritsar", state: "Punjab", lon: 74.87, lat: 31.63 },
  goa: { city: "Panaji", state: "Goa", lon: 73.83, lat: 15.49 },
  rajasthan: { city: "Jaipur", state: "Rajasthan", lon: 75.79, lat: 26.91 },
  // Nationwide / non-mappable scopes present in the data.
  india: null,
  "boston / india": null,
};

/** Returns map coordinates for a dataset location, or null when it is not a mappable point. */
export function geoFor(location: string | null | undefined): GeoPoint | null {
  if (!location) return null;
  return MAP[location.trim().toLowerCase()] ?? null;
}
