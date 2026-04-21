export type Coordinate = {
  latitude: number;
  longitude: number;
  placeName?: string;
};

export type LineString = {
  type: "LineString";
  coordinates: [number, number][];
};

export type Route = {
  geometry: LineString;
  distanceMeters: number;
  durationSeconds: number;
};
