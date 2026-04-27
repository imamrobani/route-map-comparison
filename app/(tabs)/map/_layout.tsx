import { Stack } from "expo-router";
import React from "react";

export default function MapLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Maps" }} />
      {/* <Stack.Screen name="mapbox" options={{ title: "Mapbox (Baseline)" }} />
      <Stack.Screen
        name="mapbox-nominatim"
        options={{ title: "Mapbox + Nominatim (Hybrid)" }}
      /> */}
      <Stack.Screen
        name="maplibre-demotiles"
        options={{ title: "MapLibre (Demo Tiles)" }}
      />
      <Stack.Screen
        name="leaflet"
        options={{ title: "Leaflet (Comparison)" }}
      />
    </Stack>
  );
}
