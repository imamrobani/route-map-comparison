import { Stack } from 'expo-router';
import React from 'react';

export default function MapLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Maps' }} />
      <Stack.Screen name="mapbox" options={{ title: 'Mapbox (Baseline)' }} />
      <Stack.Screen name="leaflet" options={{ title: 'Leaflet (Comparison)' }} />
    </Stack>
  );
}

