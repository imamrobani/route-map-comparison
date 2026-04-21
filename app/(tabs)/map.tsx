import MapboxGL from '@rnmapbox/maps';
import React, { useEffect } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { env } from '@/config/env';
import { useCurrentLocation } from '@/hooks/use-current-location';

export default function MapTabScreen() {
  const accessToken = env.mapboxAccessToken;
  const { error, isLoading, location, permissionStatus, refreshLocation, requestPermission } =
    useCurrentLocation();

  useEffect(() => {
    if (!accessToken) return;
    MapboxGL.setAccessToken(accessToken);
  }, [accessToken]);

  const centerCoordinate: [number, number] = location
    ? [location.longitude, location.latitude]
    : [106.84513, -6.21462];

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
        <MapboxGL.Camera centerCoordinate={centerCoordinate} zoomLevel={location ? 14 : 11} />
        <MapboxGL.LocationPuck
          puckBearingEnabled
          puckBearing="heading"
          pulsing={{
            isEnabled: true,
            radius: 'accuracy',
          }}
        />
      </MapboxGL.MapView>

      <View style={styles.overlayContainer} pointerEvents="box-none">
        {isLoading ? (
          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>Getting your location…</Text>
          </View>
        ) : null}

        {permissionStatus === 'denied' ? (
          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>Location permission is disabled.</Text>
            <Text style={styles.bannerBody}>Enable location to center the map on your position.</Text>
            <View style={styles.bannerActions}>
              <Pressable style={styles.button} onPress={requestPermission}>
                <Text style={styles.buttonText}>Try again</Text>
              </Pressable>
              <Pressable style={styles.buttonSecondary} onPress={() => void Linking.openSettings()}>
                <Text style={styles.buttonSecondaryText}>Open settings</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {permissionStatus === 'granted' && !isLoading && error ? (
          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>{error}</Text>
            <View style={styles.bannerActions}>
              <Pressable style={styles.button} onPress={refreshLocation}>
                <Text style={styles.buttonText}>Retry</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
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
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  banner: {
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  bannerTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  bannerBody: {
    color: '#fff',
    fontSize: 13,
    marginTop: 4,
    opacity: 0.9,
  },
  bannerActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  button: {
    backgroundColor: '#2563EB',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  buttonSecondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  buttonSecondaryText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
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
