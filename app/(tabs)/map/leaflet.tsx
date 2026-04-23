import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCurrentLocation } from "@/hooks/use-current-location";
import { LeafletMapView } from "@/map/leaflet/leaflet-map-view";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

export default function LeafletMapScreen() {
  const insets = useSafeAreaInsets();
  const hasCenteredRef = useRef(false);

  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [version, setVersion] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = React.useState(0);

  const {
    error: locationError,
    isLoading: isLoadingLocation,
    location,
    permissionStatus,
    refreshLocation,
    requestPermission,
  } = useCurrentLocation();

  const [shouldCenterOnUser, setShouldCenterOnUser] = React.useState(false);
  useEffect(() => {
    if (!location) return;
    if (hasCenteredRef.current) return;

    hasCenteredRef.current = true;
    setShouldCenterOnUser(true);
    const timeout = setTimeout(() => setShouldCenterOnUser(false), 250);
    return () => clearTimeout(timeout);
  }, [location]);

  const userLocation = location
    ? { latitude: location.latitude, longitude: location.longitude }
    : null;

  return (
    <View style={styles.container}>
      <LeafletMapView
        key={reloadNonce}
        userLocation={userLocation}
        centerOnUserLocation={shouldCenterOnUser}
        onReady={({ version: nextVersion }) => {
          setStatus("ready");
          setVersion(nextVersion);
          setErrorMessage(null);
        }}
        onError={({ message }) => {
          setStatus("error");
          setErrorMessage(message);
        }}
      />

      <View
        style={[
          styles.topOverlay,
          { paddingTop: Math.max(12, insets.top + 8) },
        ]}
      >
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeTitle}>Leaflet</Text>
            <Text style={styles.badgeSubtitle}>OpenStreetMap tiles</Text>
          </View>

          <View style={styles.statusPill}>
            {status === "loading" ? (
              <ActivityIndicator size="small" color="#111827" />
            ) : (
              <View
                style={[
                  styles.statusDot,
                  status === "ready"
                    ? styles.statusDotReady
                    : styles.statusDotError,
                ]}
              />
            )}
            <Text style={styles.statusText}>
              {status === "loading"
                ? "Loading…"
                : status === "ready"
                  ? `Ready${version ? ` (v${version})` : ""}`
                  : "Error"}
            </Text>
          </View>
        </View>

        {errorMessage ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Leaflet failed to load</Text>
            <Text style={styles.errorBody} numberOfLines={3}>
              {errorMessage}
            </Text>
            <Pressable
              style={styles.errorButton}
              onPress={() => {
                setStatus("loading");
                setErrorMessage(null);
                setVersion(null);
                setReloadNonce((value) => value + 1);
              }}
            >
              <Text style={styles.errorButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {permissionStatus === "denied" ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>
              Location permission is disabled
            </Text>
            <Text style={styles.errorBody}>
              Enable location to center the map on your current position.
            </Text>
            <Pressable style={styles.errorButton} onPress={requestPermission}>
              <Text style={styles.errorButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {permissionStatus === "granted" &&
        !isLoadingLocation &&
        locationError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Failed to get location</Text>
            <Text style={styles.errorBody}>{locationError}</Text>
            <Pressable style={styles.errorButton} onPress={refreshLocation}>
              <Text style={styles.errorButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <Pressable
        style={[
          styles.floatingActionButton,
          { bottom: Math.max(12, insets.bottom + 12) },
        ]}
        onPress={() => {
          if (!location) {
            void requestPermission();
            return;
          }

          setShouldCenterOnUser(true);
          setTimeout(() => setShouldCenterOnUser(false), 250);
        }}
        hitSlop={10}
      >
        <MaterialIcons name="my-location" size={20} color="#2563EB" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b1220",
  },
  topOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    gap: 10,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  badge: {
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 2,
  },
  badgeTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "800",
  },
  badgeSubtitle: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "600",
    opacity: 0.9,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusDotReady: {
    backgroundColor: "#16A34A",
  },
  statusDotError: {
    backgroundColor: "#DC2626",
  },
  statusText: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "700",
  },
  errorCard: {
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderRadius: 16,
    padding: 12,
    gap: 6,
  },
  errorTitle: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "800",
  },
  errorBody: {
    color: "#374151",
    fontSize: 12,
    opacity: 0.9,
  },
  errorButton: {
    alignSelf: "flex-start",
    backgroundColor: "#111827",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 4,
  },
  errorButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  floatingActionButton: {
    position: "absolute",
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    elevation: 6,
  },
});
