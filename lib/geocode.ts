// Strips unit/floor/suite/apt tokens that trip up free-form geocoding, e.g.
// "100 1st St 6th floor, San Francisco, CA 94105" -> "100 1st St, San Francisco, CA 94105"
export function simplifyAddress(address: string): string {
  return address
    .replace(/,?\s*\b\d+(st|nd|rd|th)?\s+floor\b/gi, '')
    .replace(/,?\s*\bfloor\s*#?\d+\b/gi, '')
    .replace(/,?\s*\b(suite|ste\.?|apt\.?|apartment|unit)\s*#?\s*\w+\b/gi, '')
    .replace(/,?\s*#\s*\w+/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s*,\s*,/g, ',')
    .trim()
}

export type GeocodeResult = { lat: number; lng: number }

async function queryNominatim(query: string): Promise<Array<{ lat: string; lon: string }>> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=0&q=${encodeURIComponent(query)}`,
  )
  if (!res.ok) throw new Error('geocode request failed')
  return res.json()
}

export async function fetchGeocode(query: string): Promise<GeocodeResult | null> {
  const trimmed = query.trim()
  if (trimmed.length < 6) return null

  const direct = await queryNominatim(trimmed)
  if (direct.length > 0) return { lat: parseFloat(direct[0].lat), lng: parseFloat(direct[0].lon) }

  const simplified = simplifyAddress(trimmed)
  if (simplified && simplified !== trimmed) {
    const fallback = await queryNominatim(simplified)
    if (fallback.length > 0) return { lat: parseFloat(fallback[0].lat), lng: parseFloat(fallback[0].lon) }
  }

  return null
}
