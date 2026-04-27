import React from "react";
import { StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

export default function MapLibreDemoTilesWebScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">MapLibre</ThemedText>
      <ThemedText style={styles.body}>
        This screen is available on native (iOS/Android) development builds
        only.
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
