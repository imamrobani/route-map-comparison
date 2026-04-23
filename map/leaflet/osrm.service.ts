export type OsrmRoute = {
  geometry: {
    coordinates: { latitude: number; longitude: number }[];
  };
  distanceMeters: number;
  durationSeconds: number;
};

type OsrmRouteResponse = {
  code: string;
  routes?: {
    distance: number;
    duration: number;
    geometry: {
      coordinates: [number, number][];
      type: string;
    };
  }[];
};

export async function getOsrmRoute({
  origin,
  destination,
  signal,
}: {
  origin: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number };
  signal?: AbortSignal;
}): Promise<OsrmRoute> {
  const baseUrl = "https://router.project-osrm.org/route/v1/driving";
  const url = new URL(
    `${baseUrl}/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`,
  );

  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("alternatives", "false");
  url.searchParams.set("steps", "false");

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`OSRM route failed (${response.status}).`);
  }

  const data = (await response.json()) as OsrmRouteResponse;
  const route = data.routes?.[0];
  if (!route) throw new Error("OSRM route not found.");

  const coordinates = Array.isArray(route.geometry?.coordinates)
    ? route.geometry.coordinates
        .map(([longitude, latitude]) => ({ latitude, longitude }))
        .filter(
          (coord) =>
            Number.isFinite(coord.latitude) && Number.isFinite(coord.longitude),
        )
    : [];

  if (coordinates.length < 2) {
    throw new Error("OSRM route geometry is empty.");
  }

  return {
    geometry: { coordinates },
    distanceMeters: route.distance,
    durationSeconds: route.duration,
  };
}
