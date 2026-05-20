/**
 * Route optimizer — Nearest-Neighbor TSP heuristic + Google Maps URL builder.
 *
 * Strategy:
 *   1. Start from origin (Victor's warehouse / configurable)
 *   2. Always visit the nearest unvisited stop next
 *   3. Return total distance (Haversine)
 *   4. Generate Google Maps multi-waypoint URL for navigation
 */

export interface RouteStop {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  phone?: string
  segment?: string
}

export interface OptimizedRoute {
  stops: RouteStop[]
  totalDistanceKm: number
  estimatedTimeMin: number   // rough estimate: avg 30 km/h in SP traffic
  googleMapsUrl: string
  wazeUrl: string
}

// Victor's default origin — Sölen/Aris warehouse area (configurable in UI)
export const DEFAULT_ORIGIN: { name: string; lat: number; lng: number; address: string } = {
  name: 'Escritório Aris',
  address: 'São Paulo, SP',
  lat: -23.5505,
  lng: -46.6333,
}

// ─── Haversine distance in km ─────────────────────────────────────────────

export function haversine(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─── Nearest-Neighbor TSP ─────────────────────────────────────────────────

export function nearestNeighborTSP(
  stops: RouteStop[],
  origin: { lat: number; lng: number },
): RouteStop[] {
  if (!stops.length) return []

  const unvisited = [...stops]
  const route: RouteStop[] = []
  let cur = origin

  while (unvisited.length > 0) {
    let bestIdx = 0
    let bestDist = haversine(cur.lat, cur.lng, unvisited[0].lat, unvisited[0].lng)

    for (let i = 1; i < unvisited.length; i++) {
      const d = haversine(cur.lat, cur.lng, unvisited[i].lat, unvisited[i].lng)
      if (d < bestDist) { bestDist = d; bestIdx = i }
    }

    route.push(unvisited[bestIdx])
    cur = unvisited[bestIdx]
    unvisited.splice(bestIdx, 1)
  }

  return route
}

// ─── Distance + time helpers ──────────────────────────────────────────────

export function routeTotalKm(
  origin: { lat: number; lng: number },
  stops: RouteStop[],
): number {
  if (!stops.length) return 0
  let total = haversine(origin.lat, origin.lng, stops[0].lat, stops[0].lng)
  for (let i = 1; i < stops.length; i++) {
    total += haversine(stops[i - 1].lat, stops[i - 1].lng, stops[i].lat, stops[i].lng)
  }
  // Return to origin
  total += haversine(
    stops[stops.length - 1].lat, stops[stops.length - 1].lng,
    origin.lat, origin.lng,
  )
  return total
}

// ─── URL builders ─────────────────────────────────────────────────────────

/**
 * Google Maps directions URL with up to 23 waypoints (Google's limit).
 * Uses coordinates for precision.
 */
export function buildGoogleMapsUrl(
  origin: { lat: number; lng: number; name?: string },
  stops: RouteStop[],
): string {
  // Google Maps dir: /maps/dir/lat,lng/lat,lng/.../lat,lng
  const pts = [
    `${origin.lat},${origin.lng}`,
    ...stops.map(s => `${s.lat},${s.lng}`),
    `${origin.lat},${origin.lng}`,   // return to origin
  ]
  const path = pts.map(p => encodeURIComponent(p)).join('/')
  return `https://maps.google.com/maps/dir/${path}`
}

export function buildWazeUrl(stops: RouteStop[]): string {
  if (!stops.length) return 'https://waze.com'
  const first = stops[0]
  return `https://waze.com/ul?ll=${first.lat},${first.lng}&navigate=yes`
}

/**
 * WhatsApp message with ordered route for a field rep.
 */
export function buildWhatsAppRoute(
  origin: { name: string },
  stops: RouteStop[],
  totalKm: number,
): string {
  const lines = [
    `🗺 *Rota do dia — ${new Date().toLocaleDateString('pt-BR')}*`,
    `🏁 Saída: ${origin.name}`,
    '',
    ...stops.map(
      (s, i) =>
        `${i + 1}. *${s.name}*\n   📍 ${s.address}${s.phone ? `\n   📞 ${s.phone}` : ''}`,
    ),
    '',
    `📏 Distância total estimada: ~${totalKm.toFixed(0)} km`,
  ]
  return encodeURIComponent(lines.join('\n'))
}

// ─── Full optimizer entry point ───────────────────────────────────────────

export function optimizeRoute(
  stops: RouteStop[],
  origin: { lat: number; lng: number; name: string; address: string } = DEFAULT_ORIGIN,
): OptimizedRoute {
  const ordered = nearestNeighborTSP(stops, origin)
  const totalDistanceKm = routeTotalKm(origin, ordered)
  const estimatedTimeMin = Math.round((totalDistanceKm / 30) * 60) // 30 km/h avg SP

  return {
    stops: ordered,
    totalDistanceKm,
    estimatedTimeMin,
    googleMapsUrl: buildGoogleMapsUrl(origin, ordered),
    wazeUrl: buildWazeUrl(ordered),
  }
}
