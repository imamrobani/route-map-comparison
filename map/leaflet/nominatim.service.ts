export type NominatimPlaceSuggestion = {
  id: string;
  placeName: string;
  center: {
    latitude: number;
    longitude: number;
  };
};

type NominatimSearchResult = {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
};

type NominatimReverseResult = {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
};

export async function searchNominatimPlaces({
  query,
  limit = 8,
  viewbox,
  signal,
}: {
  query: string;
  limit?: number;
  viewbox?: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };
  signal?: AbortSignal;
}): Promise<NominatimPlaceSuggestion[]> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('accept-language', 'en');

  if (viewbox) {
    url.searchParams.set(
      'viewbox',
      `${viewbox.left},${viewbox.top},${viewbox.right},${viewbox.bottom}`,
    );
    url.searchParams.set('bounded', '0');
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'User-Agent': 'route-map',
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Nominatim search failed (${response.status}).`);
  }

  const data = (await response.json()) as unknown;
  if (!Array.isArray(data)) return [];

  const results = data as NominatimSearchResult[];
  return results
    .map((item) => {
      const latitude = Number(item.lat);
      const longitude = Number(item.lon);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
      const placeName = typeof item.display_name === 'string' ? item.display_name : '';
      if (!placeName) return null;
      return {
        id: String(item.place_id),
        placeName,
        center: { latitude, longitude },
      } satisfies NominatimPlaceSuggestion;
    })
    .filter((item): item is NominatimPlaceSuggestion => Boolean(item));
}

export async function reverseNominatim({
  latitude,
  longitude,
  zoom = 18,
  signal,
}: {
  latitude: number;
  longitude: number;
  zoom?: number;
  signal?: AbortSignal;
}): Promise<string | null> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('lat', String(latitude));
  url.searchParams.set('lon', String(longitude));
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('zoom', String(zoom));
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('accept-language', 'en');

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'User-Agent': 'route-map',
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Nominatim reverse failed (${response.status}).`);
  }

  const data = (await response.json()) as unknown;
  const result = data as Partial<NominatimReverseResult>;
  return typeof result.display_name === 'string' && result.display_name.length > 0
    ? result.display_name
    : null;
}

