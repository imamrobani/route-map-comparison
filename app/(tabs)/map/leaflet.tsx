import React from 'react';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function LeafletMapScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Leaflet</ThemedText>
      <ThemedText style={styles.body}>
        This screen is reserved for the Leaflet implementation. The Mapbox screen remains
        unchanged for comparison.
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  body: {
    opacity: 0.8,
  },
});

