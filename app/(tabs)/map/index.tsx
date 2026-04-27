import { Link, type Href } from "expo-router";
import React from "react";
import { Pressable, StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

function MenuItem({
  href,
  title,
  description,
}: {
  href: Href;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} asChild>
      <Pressable style={styles.card}>
        <ThemedText type="subtitle">{title}</ThemedText>
        <ThemedText style={styles.cardBody}>{description}</ThemedText>
      </Pressable>
    </Link>
  );
}

export default function MapMenuScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Map Comparison</ThemedText>
        <ThemedText style={styles.body}>
          Choose which map implementation you want to open.
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.list}>
        <MenuItem
          href={"/map/mapbox" as Href}
          title="Mapbox (Baseline)"
          description="Current implementation using @rnmapbox/maps."
        />
        <MenuItem
          href={"/map/mapbox-nominatim" as Href}
          title="Mapbox + Nominatim (Hybrid)"
          description="Mapbox map with free Nominatim autocomplete; routing provider can switch."
        />
        <MenuItem
          href={"/map/leaflet"}
          title="Leaflet (Comparison)"
          description="Separate screen for Leaflet via WebView (work in progress)."
        />
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
  header: {
    gap: 8,
  },
  body: {
    opacity: 0.8,
  },
  list: {
    gap: 12,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(127, 127, 127, 0.25)",
    padding: 16,
    gap: 6,
  },
  cardBody: {
    opacity: 0.8,
  },
});
