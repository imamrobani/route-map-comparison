import MapboxGL from "@rnmapbox/maps";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { env } from "@/config/env";
import { setDestination, setOrigin } from "@/features/route/routeSlice";
import { useCurrentLocation } from "@/hooks/use-current-location";
import { usePlaceAutocomplete } from "@/hooks/use-place-autocomplete";
import type { MapboxPlaceSuggestion } from "@/services/mapbox.service";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

export default function MapTabScreen() {
  const accessToken = env.mapboxAccessToken;
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const origin = useAppSelector((state) => state.route.origin);
  const destination = useAppSelector((state) => state.route.destination);

  const cameraRef = useRef<MapboxGL.Camera>(null);

  const {
    error,
    isLoading,
    location,
    permissionStatus,
    refreshLocation,
    requestPermission,
  } = useCurrentLocation();

  const [activeField, setActiveField] = React.useState<
    "origin" | "destination" | null
  >(null);
  const [originText, setOriginText] = React.useState(origin?.placeName ?? "");
  const [destinationText, setDestinationText] = React.useState(
    destination?.placeName ?? "",
  );

  useEffect(() => {
    if (!activeField || activeField !== "origin") {
      setOriginText(origin?.placeName ?? "");
    }
  }, [activeField, origin?.placeName]);

  useEffect(() => {
    if (!activeField || activeField !== "destination") {
      setDestinationText(destination?.placeName ?? "");
    }
  }, [activeField, destination?.placeName]);

  const query =
    activeField === "origin"
      ? originText
      : activeField === "destination"
        ? destinationText
        : "";
  const {
    error: placesError,
    isLoading: isSearchingPlaces,
    suggestions,
  } = usePlaceAutocomplete(query, {
    enabled: Boolean(activeField),
    proximity: location
      ? { latitude: location.latitude, longitude: location.longitude }
      : undefined,
    debounceMs: 450,
    minLength: 3,
  });

  useEffect(() => {
    if (!accessToken) return;
    MapboxGL.setAccessToken(accessToken);
  }, [accessToken]);

  const centerCoordinate: [number, number] = destination
    ? [destination.longitude, destination.latitude]
    : origin
      ? [origin.longitude, origin.latitude]
      : location
        ? [location.longitude, location.latitude]
        : [106.84513, -6.21462];

  const originLongitude = origin?.longitude;
  const originLatitude = origin?.latitude;
  const destinationLongitude = destination?.longitude;
  const destinationLatitude = destination?.latitude;

  const originCoordinate = useMemo<[number, number] | null>(() => {
    if (
      typeof originLongitude !== "number" ||
      typeof originLatitude !== "number"
    ) {
      return null;
    }
    return [originLongitude, originLatitude];
  }, [originLatitude, originLongitude]);

  const destinationCoordinate = useMemo<[number, number] | null>(() => {
    if (
      typeof destinationLongitude !== "number" ||
      typeof destinationLatitude !== "number"
    ) {
      return null;
    }
    return [destinationLongitude, destinationLatitude];
  }, [destinationLatitude, destinationLongitude]);

  const dismissOverlay = useCallback(() => {
    setActiveField(null);
  }, []);

  const renderSuggestionSeparator = useCallback(
    () => <View style={styles.suggestionSeparator} />,
    [],
  );

  const handleSuggestionPress = useCallback(
    (item: MapboxPlaceSuggestion) => {
      if (activeField === "origin") {
        dispatch(
          setOrigin({
            latitude: item.center.latitude,
            longitude: item.center.longitude,
            placeName: item.placeName,
          }),
        );
        setOriginText(item.placeName);
      }

      if (activeField === "destination") {
        dispatch(
          setDestination({
            latitude: item.center.latitude,
            longitude: item.center.longitude,
            placeName: item.placeName,
          }),
        );
        setDestinationText(item.placeName);
      }

      setActiveField(null);
    },
    [activeField, dispatch],
  );

  const renderSuggestionItem = useCallback(
    ({ item }: { item: MapboxPlaceSuggestion }) => (
      <Pressable
        style={styles.suggestionItem}
        onPress={() => handleSuggestionPress(item)}
      >
        <Text style={styles.suggestionText} numberOfLines={1}>
          {item.placeName.split(",")[0]}
        </Text>
        <Text style={styles.suggestionSubtext} numberOfLines={1}>
          {item.placeName}
        </Text>
      </Pressable>
    ),
    [handleSuggestionPress],
  );

  useEffect(() => {
    if (
      typeof originLatitude !== "number" ||
      typeof originLongitude !== "number" ||
      typeof destinationLatitude !== "number" ||
      typeof destinationLongitude !== "number"
    ) {
      return;
    }

    cameraRef.current?.fitBounds(
      [
        Math.max(originLongitude, destinationLongitude),
        Math.max(originLatitude, destinationLatitude),
      ],
      [
        Math.min(originLongitude, destinationLongitude),
        Math.min(originLatitude, destinationLatitude),
      ],
      80,
      500,
    );
  }, [
    destinationLatitude,
    destinationLongitude,
    originLatitude,
    originLongitude,
  ]);

  if (!accessToken) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Map</Text>
        <Text style={styles.body}>
          Missing Mapbox token. Set EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN in
          .env.local, then restart the dev server.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapboxGL.MapView style={styles.map} styleURL={MapboxGL.StyleURL.Street}>
        <MapboxGL.Camera
          ref={cameraRef}
          centerCoordinate={centerCoordinate}
          zoomLevel={location || origin || destination ? 14 : 11}
        />
        <MapboxGL.LocationPuck
          puckBearingEnabled
          puckBearing="heading"
          pulsing={{
            isEnabled: true,
            radius: "accuracy",
          }}
        />

        {originCoordinate ? (
          <MapboxGL.MarkerView
            coordinate={originCoordinate}
            anchor={{ x: 0.5, y: 1 }}
            allowOverlap
          >
            <View style={styles.markerDot}>
              <View style={styles.markerDotInner} />
            </View>
          </MapboxGL.MarkerView>
        ) : null}

        {destinationCoordinate ? (
          <MapboxGL.MarkerView
            coordinate={destinationCoordinate}
            anchor={{ x: 0.5, y: 1 }}
            allowOverlap
          >
            <View style={styles.markerPin}>
              <View style={styles.markerPinInner} />
            </View>
          </MapboxGL.MarkerView>
        ) : null}
      </MapboxGL.MapView>

      <View style={styles.overlayContainer} pointerEvents="box-none">
        {activeField ? (
          <Pressable style={styles.dismissOverlay} onPress={dismissOverlay} />
        ) : null}

        <View
          style={[styles.searchCard, { marginTop: insets.top + 8 }]}
          pointerEvents="auto"
        >
          <View style={styles.searchRow}>
            <Text style={styles.searchLabel}>Origin</Text>
            <View style={styles.inputRow}>
              <View style={styles.inputIcon}>
                <IconSymbol
                  size={16}
                  name="circle.fill"
                  color="rgba(255,255,255,0.75)"
                />
              </View>
              <TextInput
                value={originText}
                onChangeText={setOriginText}
                placeholder="Search origin"
                placeholderTextColor="rgba(255,255,255,0.55)"
                style={styles.searchInput}
                onFocus={() => setActiveField("origin")}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
              {activeField === "origin" && originText.length > 0 ? (
                <Pressable
                  style={styles.clearButton}
                  onPress={() => setOriginText("")}
                  hitSlop={8}
                >
                  <IconSymbol
                    size={18}
                    name="xmark.circle.fill"
                    color="rgba(255,255,255,0.55)"
                  />
                </Pressable>
              ) : null}
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.searchRow}>
            <Text style={styles.searchLabel}>Destination</Text>
            <View style={styles.inputRow}>
              <View style={styles.inputIcon}>
                <IconSymbol
                  size={16}
                  name="mappin.circle.fill"
                  color="rgba(255,255,255,0.75)"
                />
              </View>
              <TextInput
                value={destinationText}
                onChangeText={setDestinationText}
                placeholder="Search destination"
                placeholderTextColor="rgba(255,255,255,0.55)"
                style={styles.searchInput}
                onFocus={() => setActiveField("destination")}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
              {activeField === "destination" && destinationText.length > 0 ? (
                <Pressable
                  style={styles.clearButton}
                  onPress={() => setDestinationText("")}
                  hitSlop={8}
                >
                  <IconSymbol
                    size={18}
                    name="xmark.circle.fill"
                    color="rgba(255,255,255,0.55)"
                  />
                </Pressable>
              ) : null}
            </View>
          </View>

          {activeField ? (
            <View style={styles.suggestionsContainer}>
              {query.trim().length > 0 && query.trim().length < 3 ? (
                <Text style={styles.suggestionsHint}>
                  Type at least 3 characters.
                </Text>
              ) : null}
              {placesError ? (
                <Text style={styles.suggestionsHint}>{placesError}</Text>
              ) : null}
              {isSearchingPlaces ? (
                <Text style={styles.suggestionsHint}>Searching…</Text>
              ) : null}
              {!isSearchingPlaces &&
              query.trim().length >= 3 &&
              suggestions.length === 0 &&
              !placesError ? (
                <Text style={styles.suggestionsHint}>No results.</Text>
              ) : null}

              <FlatList
                keyboardShouldPersistTaps="handled"
                data={suggestions}
                keyExtractor={(item) => item.id}
                renderItem={renderSuggestionItem}
                ItemSeparatorComponent={renderSuggestionSeparator}
              />
            </View>
          ) : null}
        </View>

        {isLoading ? (
          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>Getting your location…</Text>
          </View>
        ) : null}

        {permissionStatus === "denied" ? (
          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>
              Location permission is disabled.
            </Text>
            <Text style={styles.bannerBody}>
              Enable location to center the map on your position.
            </Text>
            <View style={styles.bannerActions}>
              <Pressable style={styles.button} onPress={requestPermission}>
                <Text style={styles.buttonText}>Try again</Text>
              </Pressable>
              <Pressable
                style={styles.buttonSecondary}
                onPress={() => void Linking.openSettings()}
              >
                <Text style={styles.buttonSecondaryText}>Open settings</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {permissionStatus === "granted" && !isLoading && error ? (
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
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  dismissOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  searchCard: {
    marginHorizontal: 12,
    backgroundColor: "rgba(17, 24, 39, 0.88)",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 6,
  },
  searchRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  searchLabel: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 12,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inputIcon: {
    width: 18,
    alignItems: "center",
  },
  searchInput: {
    color: "#fff",
    fontSize: 14,
    paddingVertical: 6,
    paddingHorizontal: 0,
    flex: 1,
  },
  clearButton: {
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  suggestionsContainer: {
    maxHeight: 260,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.12)",
  },
  suggestionsHint: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 12,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  suggestionItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  suggestionText: {
    color: "#fff",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  suggestionSubtext: {
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  suggestionSeparator: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    marginLeft: 12,
    marginRight: 12,
  },
  markerDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(37, 99, 235, 0.25)",
    borderWidth: 2,
    borderColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  markerDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2563EB",
  },
  markerPin: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(220, 38, 38, 0.25)",
    borderWidth: 2,
    borderColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
  },
  markerPinInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#DC2626",
  },
  banner: {
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  bannerTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  bannerBody: {
    color: "#fff",
    fontSize: 13,
    marginTop: 4,
    opacity: 0.9,
  },
  bannerActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  button: {
    backgroundColor: "#2563EB",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  buttonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  buttonSecondary: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  buttonSecondaryText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
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
