import axios from "axios";

export type MapboxPlaceSuggestion = {
  id: string;
  placeName: string;
  center: {
    latitude: number;
    longitude: number;
  };
};

export type SearchPlacesParams = {
  query: string;
  accessToken: string;
  proximity?: {
    latitude: number;
    longitude: number;
  };
  country?: string;
  language?: string;
  signal?: AbortSignal;
};

export type ReverseGeocodeParams = {
  latitude: number;
  longitude: number;
  accessToken: string;
  country?: string;
  language?: string;
  signal?: AbortSignal;
};

type MapboxGeocodingResponse = {
  features?: {
    id: string;
    place_name: string;
    center: [number, number];
  }[];
};

export const searchPlaces = async (
  params: SearchPlacesParams,
): Promise<MapboxPlaceSuggestion[]> => {
  const trimmedQuery = params.query.trim();
  if (!trimmedQuery) return [];

  const response = await axios.get<MapboxGeocodingResponse>(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(trimmedQuery)}.json`,
    {
      signal: params.signal,
      params: {
        access_token: params.accessToken,
        autocomplete: true,
        limit: 8,
        types: "address,poi,place,locality,neighborhood",
        country: params.country ?? "id",
        language: params.language ?? "id",
        fuzzyMatch: true,
        proximity: params.proximity
          ? `${params.proximity.longitude},${params.proximity.latitude}`
          : undefined,
      },
    },
  );

  const features = response.data.features ?? [];
  return features
    .filter(
      (feature) => Array.isArray(feature.center) && feature.center.length === 2,
    )
    .map((feature) => ({
      id: feature.id,
      placeName: feature.place_name,
      center: {
        longitude: feature.center[0],
        latitude: feature.center[1],
      },
    }));
};

export const reverseGeocode = async (
  params: ReverseGeocodeParams,
): Promise<string | null> => {
  const response = await axios.get<MapboxGeocodingResponse>(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${params.longitude},${params.latitude}.json`,
    {
      signal: params.signal,
      params: {
        access_token: params.accessToken,
        limit: 1,
        types: "address,poi",
        country: params.country ?? "id",
        language: params.language ?? "id",
      },
    },
  );

  const first = response.data.features?.[0];
  if (!first?.place_name) return null;
  return first.place_name;
};
