/**
 * RFDS live flights — Vercel Serverless Function
 *
 * Source: FlightAware commercial TV-map feed supplied by RFDS project.
 * Returns only current Pilatus PC-12 / PC-24 aircraft within Australia.
 *
 * Required Vercel environment variable:
 *   FLIGHTAWARE_MAP_KEY
 */

declare const process: {
  env: Record<string, string | undefined>;
};

const AU_BOUNDS = {
  minLon: 108,
  maxLon: 156,
  minLat: -45,
  maxLat: -9,
};

const MODEL_NAMES: Record<string, string> = {
  PC12: 'Pilatus PC-12',
  PC24: 'Pilatus PC-24 Jet',
};

function normalizeAircraftType(value: unknown): 'PC12' | 'PC24' | null {
  const normalized = String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  if (normalized.startsWith('PC12')) return 'PC12';
  if (normalized.startsWith('PC24')) return 'PC24';
  return null;
}

function numeric(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeAltitude(value: unknown): number {
  const n = numeric(value, 0);
  if (n <= 0) return 0;
  // FlightAware trackpoll commonly reports altitude in hundreds of feet.
  return n < 1000 ? Math.round(n * 100) : Math.round(n);
}

function airportCode(value: any, fallback: string): string {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  return (
    value.iata ||
    value.altIdent ||
    value.icao ||
    value.ident ||
    fallback
  );
}

function airportName(value: any): string {
  if (!value || typeof value === 'string') return '';
  return value.friendlyName || value.friendlyLocation || value.name || '';
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 8500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
        Accept: '*/*',
        ...(init.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

function cookieHeaderFromResponse(response: Response): string | undefined {
  // Node/Undici supports getSetCookie(); fallback keeps this function harmless
  // on runtimes that don't expose it.
  const headersAny = response.headers as any;
  const setCookies: string[] =
    typeof headersAny.getSetCookie === 'function'
      ? headersAny.getSetCookie()
      : [];

  if (!setCookies.length) return undefined;

  const cookiePairs = setCookies
    .map((cookie) => String(cookie).split(';', 1)[0])
    .filter(Boolean);

  return cookiePairs.length ? cookiePairs.join('; ') : undefined;
}

async function getFlightAwareSession(key: string) {
  const tvUrl = `https://www.flightaware.com/commercial/tv/map_content.rvt?key=${encodeURIComponent(key)}`;
  const response = await fetchWithTimeout(tvUrl, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`FlightAware TV map returned HTTP ${response.status}`);
  }

  const html = await response.text();
  const match = html.match(/["']TOKEN["']\s*:\s*["']([^"']+)["']/i);

  if (!match) {
    throw new Error('FlightAware token not found in TV-map response');
  }

  return {
    token: match[1],
    cookie: cookieHeaderFromResponse(response),
  };
}

async function fetchLiveFlights(key: string) {
  const session = await getFlightAwareSession(key);
  const pollUrl =
    `https://www.flightaware.com/ajax/trackpoll.rvt` +
    `?key=${encodeURIComponent(key)}` +
    `&token=${encodeURIComponent(session.token)}` +
    `&locale=en_US&summary=0`;

  const response = await fetchWithTimeout(
    pollUrl,
    {
      cache: 'no-store',
      headers: session.cookie ? { Cookie: session.cookie } : undefined,
    },
    8500,
  );

  if (!response.ok) {
    throw new Error(`FlightAware track poll returned HTTP ${response.status}`);
  }

  const data: any = await response.json();
  const flightsObj = data?.flights || {};
  const flights: any[] = [];

  for (const [id, raw] of Object.entries<any>(flightsObj)) {
    const f = raw || {};
    if (!Array.isArray(f.coord) || f.coord.length < 2) continue;

    const lon = numeric(f.coord[0], NaN);
    const lat = numeric(f.coord[1], NaN);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;

    if (
      lon < AU_BOUNDS.minLon ||
      lon > AU_BOUNDS.maxLon ||
      lat < AU_BOUNDS.minLat ||
      lat > AU_BOUNDS.maxLat
    ) {
      continue;
    }

    const type = normalizeAircraftType(
      f.type || f.aircraftType || f.aircraft?.type || f.aircraft_type,
    );
    if (!type) continue;

    const ident = String(
      f.ident || f.displayIdent || f.registration || String(id).split('-')[0] || id,
    );

    const originValue = f.origin || f.originAirport;
    const destinationValue = f.destination || f.dest || f.destinationAirport;

    flights.push({
      id: String(id),
      ident,
      type,
      modelName: MODEL_NAMES[type],
      alt: normalizeAltitude(f.altitude ?? f.alt ?? f.altitudeFt),
      speed: Math.round(numeric(f.groundspeed ?? f.speed, 0)),
      heading: Math.round(numeric(f.heading ?? f.track, 0)),
      coord: [lon, lat],
      origin: airportCode(originValue, 'Base'),
      originName: airportName(originValue),
      dest: airportCode(destinationValue, 'En route'),
      destName: airportName(destinationValue),
      timestamp: Math.round(numeric(f.timestamp, Date.now() / 1000)),
    });
  }

  return flights;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
  }

  const key = process.env.FLIGHTAWARE_MAP_KEY;
  if (!key) {
    return res.status(500).json({
      success: false,
      error: 'FLIGHTAWARE_MAP_KEY is not configured in Vercel Environment Variables.',
    });
  }

  try {
    const flights = await fetchLiveFlights(key);

    // Keep the feed responsive while avoiding a new upstream FlightAware request
    // for every single page view.
    res.setHeader(
      'Cache-Control',
      'public, s-maxage=20, stale-while-revalidate=20',
    );

    return res.status(200).json({
      success: true,
      source: 'flightaware-tv',
      count: flights.length,
      timestamp: Date.now(),
      flights,
    });
  } catch (error: any) {
    console.error('RFDS live-flight API error:', error);

    // Never substitute simulated aircraft for a live feed.
    return res.status(502).json({
      success: false,
      source: 'flightaware-tv',
      count: 0,
      timestamp: Date.now(),
      flights: [],
      error: error?.message || 'Unable to retrieve live FlightAware data.',
    });
  }
}
