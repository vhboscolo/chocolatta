/**
 * Apify integration — Google Maps scraping via compass~crawler-google-places
 *
 * Token stored in VITE_APIFY_TOKEN env var.
 * All calls are made directly from the browser (single-tenant CRM, acceptable).
 */

const ACTOR_ID = 'compass~crawler-google-places'
const BASE = 'https://api.apify.com/v2'

export const IS_APIFY_CONFIGURED = !!import.meta.env.VITE_APIFY_TOKEN

function tok(): string {
  return (import.meta.env.VITE_APIFY_TOKEN as string) ?? ''
}

// ─── Types ────────────────────────────────────────────────────────────────

export interface ApifyPlace {
  title: string
  address?: string
  phone?: string
  email?: string
  website?: string
  lat?: number
  lng?: number
  location?: { lat?: number; lng?: number }   // some actor versions nest coords
  totalScore?: number
  reviewsCount?: number
  categories?: string[]
  url?: string
}

export type ApifyRunStatus =
  | 'READY'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'TIMED-OUT'
  | 'ABORTING'
  | 'ABORTED'

export interface ApifyRun {
  id: string
  actId: string
  status: ApifyRunStatus
  startedAt?: string
  finishedAt?: string
  defaultDatasetId?: string
  stats?: { itemCount: number }
}

// ─── São Paulo cities + business categories ──────────────────────────────

export const SP_CITIES = [
  'São Paulo',
  'Guarulhos',
  'Campinas',
  'São Bernardo do Campo',
  'Santo André',
  'Osasco',
  'Mauá',
  'Carapicuíba',
  'Diadema',
  'Mogi das Cruzes',
  'Barueri',
  'Itaquaquecetuba',
  'Jundiaí',
  'São José dos Campos',
  'Santos',
  'Sorocaba',
] as const

export type SpCity = (typeof SP_CITIES)[number]

export const BUSINESS_TYPES: { label: string; query: string }[] = [
  { label: 'Supermercados', query: 'supermercado' },
  { label: 'Mercados e Mercearias', query: 'mercado mercearia' },
  { label: 'Padarias', query: 'padaria' },
  { label: 'Confeitarias', query: 'confeitaria' },
  { label: 'Lojas de Conveniência', query: 'loja conveniência' },
  { label: 'Atacadistas de Alimentos', query: 'atacadista alimentos' },
  { label: 'Distribuidoras de Alimentos', query: 'distribuidora alimentos' },
  { label: 'Cafeterias', query: 'cafeteria' },
  { label: 'Restaurantes', query: 'restaurante' },
  { label: 'Hotéis', query: 'hotel pousada' },
]

// ─── API calls ────────────────────────────────────────────────────────────

/**
 * Start a Google Maps scrape run.
 * Returns the Apify run ID.
 */
export async function startGoogleMapsScrape(params: {
  searchQuery: string
  location: string
  maxResults: number
}): Promise<string> {
  const searchString = `${params.searchQuery} em ${params.location}`

  const res = await fetch(
    `${BASE}/acts/${encodeURIComponent(ACTOR_ID)}/runs`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tok()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        searchStringsArray: [searchString],
        language: 'pt',
        maxCrawledPlacesPerSearch: Math.min(params.maxResults, 200),
        includeHistograms: false,
        includeOpeningHours: false,
        scrapeReviews: false,
        scrapeDirectories: false,
        maxImages: 0,
        additionalInfo: false,
      }),
    },
  )

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(
      (body as { error?: { message?: string } }).error?.message ??
        `Apify error ${res.status}`,
    )
  }

  const { data } = (await res.json()) as { data: ApifyRun }
  return data.id
}

/** Poll run status */
export async function getRunStatus(runId: string): Promise<ApifyRun> {
  const res = await fetch(`${BASE}/actor-runs/${runId}`, {
    headers: { Authorization: `Bearer ${tok()}` },
  })
  if (!res.ok) throw new Error(`Apify status error ${res.status}`)
  const { data } = (await res.json()) as { data: ApifyRun }
  return data
}

/** Fetch dataset items once run SUCCEEDED */
export async function getRunResults(runId: string, limit = 200): Promise<ApifyPlace[]> {
  const res = await fetch(
    `${BASE}/actor-runs/${runId}/dataset/items?limit=${limit}`,
    { headers: { Authorization: `Bearer ${tok()}` } },
  )
  if (!res.ok) throw new Error(`Apify results error ${res.status}`)
  return res.json() as Promise<ApifyPlace[]>
}

/**
 * Normalise lat/lng — some actor versions nest coords inside `location`.
 */
export function normalizeLat(p: ApifyPlace): number | undefined {
  return p.lat ?? p.location?.lat
}
export function normalizeLng(p: ApifyPlace): number | undefined {
  return p.lng ?? p.location?.lng
}

/**
 * Geocode an address using Nominatim (OpenStreetMap, free, no key needed).
 * Returns null when address is unresolvable.
 */
export async function geocodeAddress(
  address: string,
): Promise<{ lat: number; lng: number } | null> {
  try {
    const q = encodeURIComponent(address + ', Brasil')
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'pt-BR', 'User-Agent': 'CRM-Solen/1.0' } },
    )
    const data = (await res.json()) as { lat: string; lon: string }[]
    if (!data.length) return null
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch {
    return null
  }
}
