import MapboxGL from "@rnmapbox/maps";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  FlatList,
  Linking,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { env } from "@/config/env";
import { setDestination, setOrigin } from "@/features/route/routeSlice";
import { useCurrentLocation } from "@/hooks/use-current-location";
import { useDirections } from "@/hooks/use-directions";
import { usePlaceAutocomplete } from "@/hooks/use-place-autocomplete";
import type { MapboxPlaceSuggestion } from "@/services/mapbox.service";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

import { styles } from "./map.styles";

export default function MapTabScreen() {
  const accessToken = env.mapboxAccessToken;
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const origin = useAppSelector((state) => state.route.origin);
  const destination = useAppSelector((state) => state.route.destination);
  const route = useAppSelector((state) => state.route.route);
  const isLoadingRoute = useAppSelector((state) => state.route.isLoading);
  const routeError = useAppSelector((state) => state.route.error);

  const cameraRef = useRef<MapboxGL.Camera>(null);

  const {
    error: locationError,
    isLoading: isLoadingLocation,
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

  useDirections(origin, destination);

  const routeFeature = useMemo(() => {
    if (!route) return null;
    return {
      type: "Feature" as const,
      properties: {},
      geometry: route.geometry,
    };
  }, [route]);

  const routeSummary = useMemo(() => {
    if (!route) return null;

    const durationSeconds = route.durationSeconds;
    const distanceMeters = route.distanceMeters;

    if (
      typeof durationSeconds !== "number" ||
      typeof distanceMeters !== "number" ||
      !Number.isFinite(durationSeconds) ||
      !Number.isFinite(distanceMeters)
    ) {
      return null;
    }

    const minutes = Math.max(1, Math.round(durationSeconds / 60));
    const distanceKm = distanceMeters / 1000;

    return {
      etaText: `${minutes} min`,
      distanceText:
        distanceKm >= 10
          ? `${distanceKm.toFixed(0)} km`
          : `${distanceKm.toFixed(1)} km`,
    };
  }, [route]);

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

        {routeFeature ? (
          <MapboxGL.ShapeSource id="route" shape={routeFeature}>
            <MapboxGL.LineLayer
              id="route-line"
              style={{
                lineColor: "#2563EB",
                lineWidth: 5,
                lineJoin: "round",
                lineCap: "round",
                lineOpacity: 0.9,
              }}
            />
          </MapboxGL.ShapeSource>
        ) : null}

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

        {isLoadingRoute ? (
          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>Fetching route…</Text>
          </View>
        ) : null}

        {routeError && !isLoadingRoute ? (
          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>{routeError}</Text>
          </View>
        ) : null}

        {isLoadingLocation ? (
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

        {permissionStatus === "granted" &&
        !isLoadingLocation &&
        locationError ? (
          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>{locationError}</Text>
            <View style={styles.bannerActions}>
              <Pressable style={styles.button} onPress={refreshLocation}>
                <Text style={styles.buttonText}>Retry</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {routeSummary && !isLoadingRoute && !routeError ? (
          <View
            style={[
              styles.routeSummaryCard,
              { marginBottom: Math.max(12, insets.bottom + 12) },
            ]}
          >
            <View style={styles.routeSummaryRow}>
              <Text style={styles.routeSummaryLabel}>ETA</Text>
              <Text style={styles.routeSummaryValue}>
                {routeSummary.etaText}
              </Text>
            </View>
            <View style={styles.routeSummaryDivider} />
            <View style={styles.routeSummaryRow}>
              <Text style={styles.routeSummaryLabel}>Distance</Text>
              <Text style={styles.routeSummaryValue}>
                {routeSummary.distanceText}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}
