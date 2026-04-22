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

export type DirectionsParams = {
  origin: {
    latitude: number;
    longitude: number;
  };
  destination: {
    latitude: number;
    longitude: number;
  };
  accessToken: string;
  profile?: "driving" | "walking" | "cycling" | "driving-traffic";
  language?: string;
  signal?: AbortSignal;
};

export type DirectionsRoute = {
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
  distanceMeters: number;
  durationSeconds: number;
};

type MapboxGeocodingResponse = {
  features?: {
    id: string;
    place_name: string;
    center: [number, number];
  }[];
};

type MapboxDirectionsResponse = {
  routes?: {
    geometry?: {
      type?: "LineString";
      coordinates?: [number, number][];
    };
    distance?: number;
    duration?: number;
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

export const getDirectionsRoute = async (
  params: DirectionsParams,
): Promise<DirectionsRoute | null> => {
  const profile = params.profile ?? "driving";

  const response = await axios.get<MapboxDirectionsResponse>(
    `https://api.mapbox.com/directions/v5/mapbox/${profile}/${params.origin.longitude},${params.origin.latitude};${params.destination.longitude},${params.destination.latitude}`,
    {
      signal: params.signal,
      params: {
        access_token: params.accessToken,
        geometries: "geojson",
        overview: "full",
        alternatives: false,
        steps: false,
        language: params.language ?? "en",
      },
    },
  );

  const first = response.data.routes?.[0];
  const coordinates = first?.geometry?.coordinates;
  if (
    !first ||
    first.geometry?.type !== "LineString" ||
    !Array.isArray(coordinates)
  ) {
    return null;
  }

  return {
    geometry: {
      type: "LineString",
      coordinates,
    },
    distanceMeters: typeof first.distance === "number" ? first.distance : 0,
    durationSeconds: typeof first.duration === "number" ? first.duration : 0,
  };
};
