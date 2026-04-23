import { env } from "@/config/env";
import { setDestination, setOrigin } from "@/features/route/routeSlice";
import { useCurrentLocation } from "@/hooks/use-current-location";
import { useDirections } from "@/hooks/use-directions";
import { usePlaceAutocompleteController } from "@/hooks/use-place-autocomplete-controller";
import {
  getCurrentLocation,
  requestForegroundLocationPermission,
} from "@/services/location.service";
import {
  reverseGeocode,
  type MapboxPlaceSuggestion,
} from "@/services/mapbox.service";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import MapboxGL from "@rnmapbox/maps";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Linking,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { styles } from "./map.styles";

export default function MapboxMapScreen() {
  const accessToken = env.mapboxAccessToken;
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const origin = useAppSelector((state) => state.route.origin);
  const destination = useAppSelector((state) => state.route.destination);
  const route = useAppSelector((state) => state.route.route);
  const isLoadingRoute = useAppSelector((state) => state.route.isLoading);
  const routeError = useAppSelector((state) => state.route.error);

  const cameraRef = useRef<MapboxGL.Camera>(null);
  const originInputRef = useRef<TextInput>(null);
  const destinationInputRef = useRef<TextInput>(null);
  const hasUserEditedRef = useRef({ origin: false, destination: false });

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
  const [isSettingOriginFromLocation, setIsSettingOriginFromLocation] =
    React.useState(false);

  const {
    error: placesError,
    isLoading: isSearchingPlaces,
    suggestions,
    search: searchPlaces,
    reset: resetPlaces,
  } = usePlaceAutocompleteController();

  const proximity = useMemo(
    () =>
      location
        ? { latitude: location.latitude, longitude: location.longitude }
        : undefined,
    [location],
  );

  const canSwap = Boolean(
    origin ||
    destination ||
    originText.trim().length > 0 ||
    destinationText.trim().length > 0,
  );

  const handleUseCurrentLocationPress = useCallback(() => {
    if (isSettingOriginFromLocation) return;

    setActiveField(null);
    originInputRef.current?.blur();
    destinationInputRef.current?.blur();
    Keyboard.dismiss();
    resetPlaces();
    hasUserEditedRef.current.origin = false;
    hasUserEditedRef.current.destination = false;
    setIsSettingOriginFromLocation(true);

    void (async () => {
      try {
        const status = await requestForegroundLocationPermission();
        if (status !== "granted") return;

        const current = await getCurrentLocation();

        let placeName = "Current location";
        if (accessToken) {
          try {
            const resolvedName = await reverseGeocode({
              latitude: current.latitude,
              longitude: current.longitude,
              accessToken,
            });
            if (resolvedName) placeName = resolvedName;
          } catch {
            placeName = "Current location";
          }
        }

        dispatch(
          setOrigin({
            latitude: current.latitude,
            longitude: current.longitude,
            placeName,
          }),
        );
        setOriginText(placeName);
        hasUserEditedRef.current.origin = false;
      } finally {
        setIsSettingOriginFromLocation(false);
      }
    })();
  }, [accessToken, dispatch, isSettingOriginFromLocation, resetPlaces]);

  const handleSwapPress = useCallback(() => {
    if (!canSwap) return;

    const nextOrigin = destination;
    const nextDestination = origin;

    setActiveField(null);
    originInputRef.current?.blur();
    destinationInputRef.current?.blur();
    Keyboard.dismiss();
    resetPlaces();
    dispatch(setOrigin(nextOrigin));
    dispatch(setDestination(nextDestination));
    setOriginText(nextOrigin?.placeName ?? "");
    setDestinationText(nextDestination?.placeName ?? "");

    hasUserEditedRef.current.origin = false;
    hasUserEditedRef.current.destination = false;
  }, [canSwap, destination, dispatch, origin, resetPlaces]);

  const activeQuery =
    activeField === "origin"
      ? originText
      : activeField === "destination"
        ? destinationText
        : "";

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

  const routeBounds = useMemo(() => {
    const coordinates = route?.geometry?.coordinates;
    if (!coordinates || coordinates.length === 0) return null;

    let minLongitude = Number.POSITIVE_INFINITY;
    let minLatitude = Number.POSITIVE_INFINITY;
    let maxLongitude = Number.NEGATIVE_INFINITY;
    let maxLatitude = Number.NEGATIVE_INFINITY;

    for (const [longitude, latitude] of coordinates) {
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) continue;
      minLongitude = Math.min(minLongitude, longitude);
      minLatitude = Math.min(minLatitude, latitude);
      maxLongitude = Math.max(maxLongitude, longitude);
      maxLatitude = Math.max(maxLatitude, latitude);
    }

    if (
      !Number.isFinite(minLongitude) ||
      !Number.isFinite(minLatitude) ||
      !Number.isFinite(maxLongitude) ||
      !Number.isFinite(maxLatitude)
    ) {
      return null;
    }

    return {
      ne: [maxLongitude, maxLatitude] as [number, number],
      sw: [minLongitude, minLatitude] as [number, number],
    };
  }, [route?.geometry?.coordinates]);

  const shouldShowRouteSummary = Boolean(
    routeSummary && !isLoadingRoute && !routeError,
  );
  const recenterBottomOffset =
    Math.max(12, insets.bottom + 12) + (shouldShowRouteSummary ? 100 : 0);

  const handleRecenterPress = useCallback(() => {
    if (routeBounds) {
      cameraRef.current?.fitBounds(routeBounds.ne, routeBounds.sw, 80, 450);
      return;
    }

    if (originCoordinate && destinationCoordinate) {
      cameraRef.current?.fitBounds(
        [
          Math.max(originCoordinate[0], destinationCoordinate[0]),
          Math.max(originCoordinate[1], destinationCoordinate[1]),
        ],
        [
          Math.min(originCoordinate[0], destinationCoordinate[0]),
          Math.min(originCoordinate[1], destinationCoordinate[1]),
        ],
        80,
        450,
      );
      return;
    }

    const fallbackCenter: [number, number] | null = location
      ? [location.longitude, location.latitude]
      : (originCoordinate ?? destinationCoordinate);

    if (!fallbackCenter) return;
    cameraRef.current?.setCamera({
      centerCoordinate: fallbackCenter,
      zoomLevel: 14,
      animationDuration: 450,
    });
  }, [destinationCoordinate, location, originCoordinate, routeBounds]);

  const dismissOverlay = useCallback(() => {
    setActiveField(null);
    originInputRef.current?.blur();
    destinationInputRef.current?.blur();
    Keyboard.dismiss();
    resetPlaces();
  }, [resetPlaces]);

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
        hasUserEditedRef.current.origin = false;
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
        hasUserEditedRef.current.destination = false;
      }

      setActiveField(null);
      originInputRef.current?.blur();
      destinationInputRef.current?.blur();
      Keyboard.dismiss();
      resetPlaces();
    },
    [activeField, dispatch, resetPlaces],
  );

  const handleOriginFocus = useCallback(() => {
    if (activeField !== "origin") resetPlaces();
    setActiveField("origin");

    if (hasUserEditedRef.current.origin && originText.trim().length >= 3) {
      searchPlaces({
        query: originText,
        proximity,
        enabled: true,
        minLength: 3,
        debounceMs: 450,
      });
    }
  }, [activeField, originText, proximity, resetPlaces, searchPlaces]);

  const handleDestinationFocus = useCallback(() => {
    if (activeField !== "destination") resetPlaces();
    setActiveField("destination");

    if (
      hasUserEditedRef.current.destination &&
      destinationText.trim().length >= 3
    ) {
      searchPlaces({
        query: destinationText,
        proximity,
        enabled: true,
        minLength: 3,
        debounceMs: 450,
      });
    }
  }, [activeField, destinationText, proximity, resetPlaces, searchPlaces]);

  const handleOriginChangeText = useCallback(
    (text: string) => {
      setOriginText(text);
      hasUserEditedRef.current.origin = true;

      if (origin && text.trim() !== origin.placeName) {
        dispatch(setOrigin(null));
      }

      searchPlaces({
        query: text,
        proximity,
        enabled: true,
        minLength: 3,
        debounceMs: 450,
      });
    },
    [dispatch, origin, proximity, searchPlaces],
  );

  const handleDestinationChangeText = useCallback(
    (text: string) => {
      setDestinationText(text);
      hasUserEditedRef.current.destination = true;

      if (destination && text.trim() !== destination.placeName) {
        dispatch(setDestination(null));
      }

      searchPlaces({
        query: text,
        proximity,
        enabled: true,
        minLength: 3,
        debounceMs: 450,
      });
    },
    [destination, dispatch, proximity, searchPlaces],
  );

  const handleClearOrigin = useCallback(() => {
    setOriginText("");
    hasUserEditedRef.current.origin = false;
    dispatch(setOrigin(null));
    resetPlaces();
  }, [dispatch, resetPlaces]);

  const handleClearDestination = useCallback(() => {
    setDestinationText("");
    hasUserEditedRef.current.destination = false;
    dispatch(setDestination(null));
    resetPlaces();
  }, [dispatch, resetPlaces]);

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

        <View style={styles.safeAreaTop} pointerEvents="box-none">
          <View
            style={[styles.searchCard, { marginTop: 8 }]}
            pointerEvents="auto"
          >
            <View style={styles.searchRow}>
              <Text style={[styles.searchLabel, styles.originLabel]}>
                Point A (Origin)
              </Text>
              <View style={styles.inputRow}>
                <View style={styles.inputIcon}>
                  <MaterialIcons
                    name="radio-button-checked"
                    size={18}
                    color="#2563EB"
                  />
                </View>
                <TextInput
                  ref={originInputRef}
                  value={originText}
                  onChangeText={handleOriginChangeText}
                  placeholder="Search origin"
                  placeholderTextColor="#9CA3AF"
                  style={styles.searchInput}
                  onFocus={handleOriginFocus}
                  onBlur={() => {
                    if (activeField === "origin") {
                      setActiveField(null);
                      resetPlaces();
                    }
                  }}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                />
                {activeField === "origin" && originText.length > 0 ? (
                  <Pressable
                    style={styles.clearButton}
                    onPress={handleClearOrigin}
                    hitSlop={8}
                  >
                    <MaterialIcons name="cancel" size={18} color="#9CA3AF" />
                  </Pressable>
                ) : null}
              </View>
            </View>

            {canSwap ? (
              <View style={styles.swapBetweenRow} pointerEvents="box-none">
                <Pressable
                  style={styles.swapBetweenButton}
                  onPress={handleSwapPress}
                  hitSlop={10}
                  pointerEvents="auto"
                >
                  <MaterialIcons name="swap-vert" size={18} color="#2563EB" />
                </Pressable>
              </View>
            ) : null}

            <View style={styles.divider} />

            <View style={styles.searchRow}>
              <Text style={[styles.searchLabel, styles.destinationLabel]}>
                Point B (Destination)
              </Text>
              <View style={styles.inputRow}>
                <View style={styles.inputIcon}>
                  <MaterialIcons name="place" size={18} color="#F97316" />
                </View>
                <TextInput
                  ref={destinationInputRef}
                  value={destinationText}
                  onChangeText={handleDestinationChangeText}
                  placeholder="Search destination"
                  placeholderTextColor="#9CA3AF"
                  style={styles.searchInput}
                  onFocus={handleDestinationFocus}
                  onBlur={() => {
                    if (activeField === "destination") {
                      setActiveField(null);
                      resetPlaces();
                    }
                  }}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                />
                {activeField === "destination" && destinationText.length > 0 ? (
                  <Pressable
                    style={styles.clearButton}
                    onPress={handleClearDestination}
                    hitSlop={8}
                  >
                    <MaterialIcons name="cancel" size={18} color="#9CA3AF" />
                  </Pressable>
                ) : null}
              </View>
            </View>

            {activeField &&
            hasUserEditedRef.current[activeField] &&
            activeQuery.trim().length > 0 ? (
              <View style={styles.suggestionsContainer}>
                {activeQuery.trim().length < 3 ? (
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
                activeQuery.trim().length >= 3 &&
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

          <View style={styles.belowCardActions} pointerEvents="box-none">
            <Pressable
              style={styles.belowCardIconButton}
              onPress={handleUseCurrentLocationPress}
              hitSlop={8}
              pointerEvents="auto"
            >
              {isSettingOriginFromLocation ? (
                <ActivityIndicator size="small" color="#2563EB" />
              ) : (
                <MaterialIcons name="my-location" size={18} color="#2563EB" />
              )}
            </Pressable>
          </View>
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

        <Pressable
          style={[
            styles.floatingActionButton,
            { bottom: recenterBottomOffset },
          ]}
          onPress={handleRecenterPress}
          hitSlop={10}
        >
          <MaterialIcons name="center-focus-strong" size={20} color="#2563EB" />
        </Pressable>
      </View>
    </View>
  );
}
