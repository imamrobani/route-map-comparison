import MapboxGL from '@rnmapbox/maps';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { env } from '@/config/env';

export default function MapTabScreen() {
  const accessToken = env.mapboxAccessToken;

  useEffect(() => {
    if (!accessToken) return;
    MapboxGL.setAccessToken(accessToken);
  }, [accessToken]);

  if (!accessToken) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Map</Text>
        <Text style={styles.body}>
          Missing Mapbox token. Set EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN in .env.local, then restart the
          dev server.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapboxGL.MapView style={styles.map} styleURL={MapboxGL.StyleURL.Street}>
        <MapboxGL.Camera centerCoordinate={[106.84513, -6.21462]} zoomLevel={11} />
      </MapboxGL.MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 48,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    marginHorizontal: 16,
  },
});
