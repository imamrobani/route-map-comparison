import { env } from "@/config/env";
import type { Coordinate, Route } from "@/features/route/types";
import { useCurrentLocation } from "@/hooks/use-current-location";
import { useNominatimAutocompleteController } from "@/hooks/use-nominatim-autocomplete-controller";
import {
  reverseNominatim,
  type NominatimPlaceSuggestion,
} from "@/map/leaflet/nominatim.service";
import { getOsrmRoute } from "@/map/leaflet/osrm.service";
import { MapSearchCard } from "@/map/shared/map-search-card";
import { isAbortError, toErrorMessage } from "@/services/errors";
import {
  getCurrentLocation,
  requestForegroundLocationPermission,
} from "@/services/location.service";
import { getDirectionsRoute } from "@/services/mapbox.service";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import MapboxGL from "@rnmapbox/maps";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { styles } from "./map.styles";

type RoutingProvider = "mapbox" | "osrm";
type PickMode = "origin" | "destination";

export default function MapboxNominatimMapScreen() {
  const accessToken = env.mapboxAccessToken;
  const insets = useSafeAreaInsets();

  const mapRef = useRef<MapboxGL.MapView>(null);
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
  const [originText, setOriginText] = React.useState("");
  const [destinationText, setDestinationText] = React.useState("");
  const [origin, setOrigin] = React.useState<Coordinate | null>(null);
  const [destination, setDestination] = React.useState<Coordinate | null>(null);

  const [provider, setProvider] = React.useState<RoutingProvider>("mapbox");
  const [route, setRoute] = React.useState<Route | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = React.useState(false);
  const [routeError, setRouteError] = React.useState<string | null>(null);
  const routeAbortControllerRef = useRef<AbortController | null>(null);
  const routeRequestIdRef = useRef(0);

  const [pickMode, setPickMode] = React.useState<PickMode | null>(null);
  const [isConfirmingPick, setIsConfirmingPick] = React.useState(false);
  const [pickError, setPickError] = React.useState<string | null>(null);

  const [isPickCardVisible, setIsPickCardVisible] = React.useState(true);
  const [isRoutingCardVisible, setIsRoutingCardVisible] = React.useState(true);

  const [isSettingOriginFromLocation, setIsSettingOriginFromLocation] =
    React.useState(false);

  const {
    error: placesError,
    isLoading: isSearchingPlaces,
    suggestions,
    search: searchPlaces,
    reset: resetPlaces,
  } = useNominatimAutocompleteController();

  const canSwap = Boolean(
    origin ||
    destination ||
    originText.trim().length > 0 ||
    destinationText.trim().length > 0,
  );

  useEffect(() => {
    if (!accessToken) return;
    MapboxGL.setAccessToken(accessToken);
  }, [accessToken]);

  const activeQuery =
    activeField === "origin"
      ? originText
      : activeField === "destination"
        ? destinationText
        : "";

  const shouldShowSuggestions = Boolean(
    activeField &&
    hasUserEditedRef.current[activeField] &&
    activeQuery.length > 0,
  );

  const suggestionsHint = useMemo(() => {
    if (!shouldShowSuggestions) return null;
    if (activeQuery.trim().length < 3) return "Type at least 3 characters.";
    if (placesError) return placesError;
    if (isSearchingPlaces) return "Searching…";
    if (activeQuery.trim().length >= 3 && suggestions.length === 0)
      return "No results.";
    return null;
  }, [
    activeQuery,
    isSearchingPlaces,
    placesError,
    shouldShowSuggestions,
    suggestions.length,
  ]);

  const centerCoordinate: [number, number] = destination
    ? [destination.longitude, destination.latitude]
    : origin
      ? [origin.longitude, origin.latitude]
      : location
        ? [location.longitude, location.latitude]
        : [106.84513, -6.21462];

  const originCoordinate = useMemo<[number, number] | null>(() => {
    if (!origin) return null;
    if (!Number.isFinite(origin.longitude) || !Number.isFinite(origin.latitude))
      return null;
    return [origin.longitude, origin.latitude];
  }, [origin]);

  const destinationCoordinate = useMemo<[number, number] | null>(() => {
    if (!destination) return null;
    if (
      !Number.isFinite(destination.longitude) ||
      !Number.isFinite(destination.latitude)
    )
      return null;
    return [destination.longitude, destination.latitude];
  }, [destination]);

  const routeFeature = useMemo(() => {
    if (!route) return null;
    return {
      type: "Feature" as const,
      properties: {},
      geometry: route.geometry,
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

  const routeSummary = useMemo(() => {
    if (!route) return null;

    const durationSeconds = route.durationSeconds;
    const distanceMeters = route.distanceMeters;
    if (!Number.isFinite(durationSeconds) || !Number.isFinite(distanceMeters))
      return null;

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

  const shouldShowRouteSummary = Boolean(
    routeSummary && !isLoadingRoute && !routeError,
  );
  const recenterBottomOffset =
    Math.max(12, insets.bottom + 12) + (shouldShowRouteSummary ? 100 : 0);

  const dismissOverlay = useCallback(() => {
    setActiveField(null);
    originInputRef.current?.blur();
    destinationInputRef.current?.blur();
    Keyboard.dismiss();
    resetPlaces();
  }, [resetPlaces]);

  const startPickMode = useCallback(
    (mode: PickMode) => {
      dismissOverlay();
      setPickMode(mode);
      setPickError(null);
    },
    [dismissOverlay],
  );

  const cancelPickMode = useCallback(() => {
    setPickMode(null);
    setPickError(null);
    setIsConfirmingPick(false);
  }, []);

  const confirmPickMode = useCallback(async () => {
    if (!pickMode) return;
    if (isConfirmingPick) return;

    setIsConfirmingPick(true);
    setPickError(null);

    try {
      const center = await mapRef.current?.getCenter();
      if (!center || !Array.isArray(center) || center.length < 2) {
        setPickError("Failed to read map center.");
        return;
      }

      const longitude = Number(center[0]);
      const latitude = Number(center[1]);
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
        setPickError("Failed to read map center.");
        return;
      }

      let placeName = "Dropped pin";
      try {
        const resolvedName = await reverseNominatim({ latitude, longitude });
        if (resolvedName) placeName = resolvedName;
      } catch {
        placeName = "Dropped pin";
      }

      if (pickMode === "origin") {
        setOrigin({ latitude, longitude, placeName });
        setOriginText(placeName);
        hasUserEditedRef.current.origin = false;
      } else {
        setDestination({ latitude, longitude, placeName });
        setDestinationText(placeName);
        hasUserEditedRef.current.destination = false;
      }

      setPickMode(null);
    } finally {
      setIsConfirmingPick(false);
    }
  }, [isConfirmingPick, pickMode]);

  const handleSuggestionPress = useCallback(
    (item: NominatimPlaceSuggestion) => {
      if (activeField === "origin") {
        setOrigin({
          latitude: item.center.latitude,
          longitude: item.center.longitude,
          placeName: item.placeName,
        });
        setOriginText(item.placeName);
        hasUserEditedRef.current.origin = false;
      }

      if (activeField === "destination") {
        setDestination({
          latitude: item.center.latitude,
          longitude: item.center.longitude,
          placeName: item.placeName,
        });
        setDestinationText(item.placeName);
        hasUserEditedRef.current.destination = false;
      }

      setActiveField(null);
      originInputRef.current?.blur();
      destinationInputRef.current?.blur();
      Keyboard.dismiss();
      resetPlaces();
    },
    [activeField, resetPlaces],
  );

  const handleOriginFocus = useCallback(() => {
    if (activeField !== "origin") resetPlaces();
    setActiveField("origin");

    if (hasUserEditedRef.current.origin && originText.trim().length >= 3) {
      searchPlaces({
        query: originText,
        enabled: true,
        minLength: 3,
        debounceMs: 450,
      });
    }
  }, [activeField, originText, resetPlaces, searchPlaces]);

  const handleDestinationFocus = useCallback(() => {
    if (activeField !== "destination") resetPlaces();
    setActiveField("destination");

    if (
      hasUserEditedRef.current.destination &&
      destinationText.trim().length >= 3
    ) {
      searchPlaces({
        query: destinationText,
        enabled: true,
        minLength: 3,
        debounceMs: 450,
      });
    }
  }, [activeField, destinationText, resetPlaces, searchPlaces]);

  const handleOriginChangeText = useCallback(
    (text: string) => {
      setOriginText(text);
      hasUserEditedRef.current.origin = true;

      if (origin && text.trim() !== (origin.placeName ?? "")) {
        setOrigin(null);
      }

      searchPlaces({
        query: text,
        enabled: true,
        minLength: 3,
        debounceMs: 450,
      });
    },
    [origin, searchPlaces],
  );

  const handleDestinationChangeText = useCallback(
    (text: string) => {
      setDestinationText(text);
      hasUserEditedRef.current.destination = true;

      if (destination && text.trim() !== (destination.placeName ?? "")) {
        setDestination(null);
      }

      searchPlaces({
        query: text,
        enabled: true,
        minLength: 3,
        debounceMs: 450,
      });
    },
    [destination, searchPlaces],
  );

  const handleClearOrigin = useCallback(() => {
    setOriginText("");
    hasUserEditedRef.current.origin = false;
    setOrigin(null);
    resetPlaces();
  }, [resetPlaces]);

  const handleClearDestination = useCallback(() => {
    setDestinationText("");
    hasUserEditedRef.current.destination = false;
    setDestination(null);
    resetPlaces();
  }, [resetPlaces]);

  const handleSwapPress = useCallback(() => {
    if (!canSwap) return;

    const nextOrigin = destination;
    const nextDestination = origin;

    setActiveField(null);
    originInputRef.current?.blur();
    destinationInputRef.current?.blur();
    Keyboard.dismiss();
    resetPlaces();
    setOrigin(nextOrigin);
    setDestination(nextDestination);
    setOriginText(nextOrigin?.placeName ?? "");
    setDestinationText(nextDestination?.placeName ?? "");

    hasUserEditedRef.current.origin = false;
    hasUserEditedRef.current.destination = false;
  }, [canSwap, destination, origin, resetPlaces]);

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

        try {
          const resolvedName = await reverseNominatim({
            latitude: current.latitude,
            longitude: current.longitude,
          });
          if (resolvedName) placeName = resolvedName;
        } catch {
          placeName = "Current location";
        }

        setOrigin({
          latitude: current.latitude,
          longitude: current.longitude,
          placeName,
        });
        setOriginText(placeName);
        hasUserEditedRef.current.origin = false;
      } finally {
        setIsSettingOriginFromLocation(false);
      }
    })();
  }, [isSettingOriginFromLocation, resetPlaces]);

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

  useEffect(() => {
    const originLatitude = origin?.latitude;
    const originLongitude = origin?.longitude;
    const destinationLatitude = destination?.latitude;
    const destinationLongitude = destination?.longitude;

    if (
      typeof originLatitude !== "number" ||
      typeof originLongitude !== "number" ||
      typeof destinationLatitude !== "number" ||
      typeof destinationLongitude !== "number"
    ) {
      if (routeAbortControllerRef.current) {
        routeAbortControllerRef.current.abort();
        routeAbortControllerRef.current = null;
      }
      setIsLoadingRoute(false);
      setRoute(null);
      setRouteError(null);
      return;
    }

    if (routeAbortControllerRef.current) {
      routeAbortControllerRef.current.abort();
      routeAbortControllerRef.current = null;
    }

    const controller = new AbortController();
    routeAbortControllerRef.current = controller;
    const requestId = routeRequestIdRef.current + 1;
    routeRequestIdRef.current = requestId;

    setIsLoadingRoute(true);
    setRouteError(null);
    setRoute(null);

    void (async () => {
      try {
        if (provider === "mapbox") {
          if (!accessToken) {
            setRoute(null);
            setRouteError("Missing Mapbox access token.");
            return;
          }

          const nextRoute = await getDirectionsRoute({
            origin: { latitude: originLatitude, longitude: originLongitude },
            destination: {
              latitude: destinationLatitude,
              longitude: destinationLongitude,
            },
            accessToken,
            signal: controller.signal,
          });

          if (controller.signal.aborted) return;
          if (routeRequestIdRef.current !== requestId) return;
          if (!nextRoute) {
            setRoute(null);
            setRouteError("No route found.");
            return;
          }

          setRoute(nextRoute);
          return;
        }

        const osrm = await getOsrmRoute({
          origin: { latitude: originLatitude, longitude: originLongitude },
          destination: {
            latitude: destinationLatitude,
            longitude: destinationLongitude,
          },
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;
        if (routeRequestIdRef.current !== requestId) return;

        const osrmCoordinates = osrm.geometry.coordinates.map((coord) => [
          coord.longitude,
          coord.latitude,
        ]) as [number, number][];

        const nextRoute: Route = {
          geometry: {
            type: "LineString",
            coordinates: osrmCoordinates,
          },
          distanceMeters: osrm.distanceMeters,
          durationSeconds: osrm.durationSeconds,
        };

        setRoute(nextRoute);
      } catch (error) {
        if (controller.signal.aborted || isAbortError(error)) return;
        if (routeRequestIdRef.current !== requestId) return;
        setRoute(null);
        setRouteError(toErrorMessage(error, "Failed to fetch route."));
      } finally {
        if (controller.signal.aborted) return;
        if (routeRequestIdRef.current !== requestId) return;
        setIsLoadingRoute(false);
      }
    })();

    return () => {
      controller.abort();
    };
  }, [
    accessToken,
    destination?.latitude,
    destination?.longitude,
    origin?.latitude,
    origin?.longitude,
    provider,
  ]);

  useEffect(() => {
    if (!originCoordinate || !destinationCoordinate) return;
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
      500,
    );
  }, [destinationCoordinate, originCoordinate]);

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
      <MapboxGL.MapView
        ref={mapRef}
        style={styles.map}
        styleURL={MapboxGL.StyleURL.Street}
      >
        <MapboxGL.Camera
          ref={cameraRef}
          centerCoordinate={centerCoordinate}
          zoomLevel={location || origin || destination ? 14 : 11}
        />
        <MapboxGL.LocationPuck
          puckBearingEnabled
          puckBearing="heading"
          pulsing={{ isEnabled: true, radius: "accuracy" }}
        />

        {routeFeature ? (
          <MapboxGL.ShapeSource id="route" shape={routeFeature}>
            <MapboxGL.LineLayer
              id="route-line"
              style={{
                lineColor: provider === "osrm" ? "#16A34A" : "#2563EB",
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
        {pickMode ? (
          <View style={pickStyles.crosshair} pointerEvents="none">
            <View style={pickStyles.crosshairOuter}>
              <View style={pickStyles.crosshairInner} />
            </View>
          </View>
        ) : null}

        {activeField ? (
          <Pressable style={styles.dismissOverlay} onPress={dismissOverlay} />
        ) : null}

        <View style={styles.safeAreaTop} pointerEvents="box-none">
          {pickMode ? (
            <View
              style={[styles.banner, { marginTop: 8, marginHorizontal: 16 }]}
            >
              <Text style={styles.bannerTitle}>
                Picking {pickMode === "origin" ? "Origin" : "Destination"}
              </Text>
              <Text style={styles.bannerBody}>
                Move the map to place the crosshair on the correct location.
              </Text>
            </View>
          ) : (
            <>
              <MapSearchCard
                containerStyle={{ marginTop: 8, marginHorizontal: 16 }}
                originInputRef={originInputRef}
                destinationInputRef={destinationInputRef}
                activeField={activeField}
                originText={originText}
                destinationText={destinationText}
                onOriginChangeText={handleOriginChangeText}
                onDestinationChangeText={handleDestinationChangeText}
                onOriginFocus={handleOriginFocus}
                onDestinationFocus={handleDestinationFocus}
                onOriginBlur={() => {
                  if (activeField === "origin") setActiveField(null);
                }}
                onDestinationBlur={() => {
                  if (activeField === "destination") setActiveField(null);
                }}
                onClearOrigin={handleClearOrigin}
                onClearDestination={handleClearDestination}
                canSwap={canSwap}
                onSwap={handleSwapPress}
                showSuggestions={shouldShowSuggestions}
                suggestions={suggestions}
                suggestionsHint={suggestionsHint}
                onSuggestionPress={handleSuggestionPress}
              />

              {!isPickCardVisible || !isRoutingCardVisible ? (
                <View style={styles.belowCardActions} pointerEvents="auto">
                  {!isPickCardVisible ? (
                    <Pressable
                      style={styles.belowCardIconButton}
                      onPress={() => setIsPickCardVisible(true)}
                      hitSlop={10}
                    >
                      <MaterialIcons
                        name="add-location-alt"
                        size={18}
                        color="#111827"
                      />
                    </Pressable>
                  ) : null}
                  {!isRoutingCardVisible ? (
                    <Pressable
                      style={styles.belowCardIconButton}
                      onPress={() => setIsRoutingCardVisible(true)}
                      hitSlop={10}
                    >
                      <MaterialIcons
                        name="alt-route"
                        size={18}
                        color="#111827"
                      />
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              {isPickCardVisible ? (
                <View
                  style={[styles.banner, { marginHorizontal: 16 }]}
                  pointerEvents="auto"
                >
                  <View style={panelStyles.bannerHeader}>
                    <Text style={styles.bannerTitle}>Pick on map</Text>
                    <Pressable
                      style={styles.quickActionButton}
                      onPress={() => setIsPickCardVisible(false)}
                      hitSlop={10}
                    >
                      <MaterialIcons
                        name="expand-less"
                        size={18}
                        color="#111827"
                      />
                    </Pressable>
                  </View>
                  <Text style={styles.bannerBody}>
                    If you can’t find a place, pick it by moving the map under
                    the crosshair.
                  </Text>
                  <View style={styles.bannerActions}>
                    <Pressable
                      style={styles.buttonSecondary}
                      onPress={() => startPickMode("origin")}
                    >
                      <Text style={styles.buttonSecondaryText}>
                        Pick Origin
                      </Text>
                    </Pressable>
                    <Pressable
                      style={styles.button}
                      onPress={() => startPickMode("destination")}
                    >
                      <Text style={styles.buttonText}>Pick Destination</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              {isRoutingCardVisible ? (
                <View
                  style={[styles.banner, { marginHorizontal: 16 }]}
                  pointerEvents="auto"
                >
                  <View style={providerStyles.row}>
                    <View style={providerStyles.titleRow}>
                      <Text style={styles.bannerTitle}>Routing Provider</Text>
                      <View style={panelStyles.bannerHeaderRight}>
                        {isLoadingRoute ? (
                          <ActivityIndicator size="small" color="#2563EB" />
                        ) : null}
                        <Pressable
                          style={styles.quickActionButton}
                          onPress={() => setIsRoutingCardVisible(false)}
                          hitSlop={10}
                        >
                          <MaterialIcons
                            name="expand-less"
                            size={18}
                            color="#111827"
                          />
                        </Pressable>
                      </View>
                    </View>

                    <View style={providerStyles.segmented}>
                      <Pressable
                        style={[
                          providerStyles.segment,
                          provider === "mapbox"
                            ? providerStyles.segmentActive
                            : null,
                        ]}
                        onPress={() => {
                          setProvider("mapbox");
                          setRoute(null);
                          setRouteError(null);
                        }}
                      >
                        <Text
                          style={[
                            providerStyles.segmentText,
                            provider === "mapbox"
                              ? providerStyles.segmentTextActive
                              : null,
                          ]}
                        >
                          Mapbox
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[
                          providerStyles.segment,
                          provider === "osrm"
                            ? providerStyles.segmentActive
                            : null,
                        ]}
                        onPress={() => {
                          setProvider("osrm");
                          setRoute(null);
                          setRouteError(null);
                        }}
                      >
                        <Text
                          style={[
                            providerStyles.segmentText,
                            provider === "osrm"
                              ? providerStyles.segmentTextActive
                              : null,
                          ]}
                        >
                          OSRM
                        </Text>
                      </Pressable>
                    </View>
                  </View>

                  {routeError && !isLoadingRoute ? (
                    <Text style={[styles.bannerBody, { color: "#B91C1C" }]}>
                      {routeError}
                    </Text>
                  ) : null}
                  {!routeError && routeSummary ? (
                    <Text style={styles.bannerBody}>
                      {routeSummary.distanceText} · {routeSummary.etaText}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {permissionStatus === "denied" ? (
                <View
                  style={[styles.banner, { marginHorizontal: 16 }]}
                  pointerEvents="auto"
                >
                  <Text style={styles.bannerTitle}>
                    Location permission is disabled
                  </Text>
                  <Text style={styles.bannerBody}>
                    Enable location to center the map on your current position.
                  </Text>
                  <Pressable
                    style={providerStyles.inlineButton}
                    onPress={requestPermission}
                  >
                    <Text style={providerStyles.inlineButtonText}>
                      Try again
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              {permissionStatus === "granted" &&
              !isLoadingLocation &&
              locationError ? (
                <View
                  style={[styles.banner, { marginHorizontal: 16 }]}
                  pointerEvents="auto"
                >
                  <Text style={styles.bannerTitle}>Failed to get location</Text>
                  <Text style={styles.bannerBody}>{locationError}</Text>
                  <Pressable
                    style={providerStyles.inlineButton}
                    onPress={refreshLocation}
                  >
                    <Text style={providerStyles.inlineButtonText}>Retry</Text>
                  </Pressable>
                </View>
              ) : null}
            </>
          )}
        </View>
      </View>

      {pickMode ? (
        <View
          style={[
            pickStyles.pickerSheet,
            {
              paddingBottom: Math.max(12, insets.bottom + 12),
            },
          ]}
          pointerEvents="auto"
        >
          {pickError ? (
            <Text style={[styles.bannerBody, { color: "#B91C1C" }]}>
              {pickError}
            </Text>
          ) : null}
          <View style={pickStyles.pickerActions}>
            <Pressable
              style={[styles.buttonSecondary, pickStyles.pickerButton]}
              onPress={cancelPickMode}
              disabled={isConfirmingPick}
            >
              <Text style={styles.buttonSecondaryText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.button, pickStyles.pickerButton]}
              onPress={confirmPickMode}
              disabled={isConfirmingPick}
            >
              {isConfirmingPick ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.buttonText}>
                  Set {pickMode === "origin" ? "Origin" : "Destination"}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : null}

      {shouldShowRouteSummary && routeSummary ? (
        <View
          style={[
            styles.routeSummaryCard,
            { bottom: Math.max(12, insets.bottom + 12) },
          ]}
          pointerEvents="none"
        >
          <View style={styles.routeSummaryRow}>
            <Text style={styles.routeSummaryLabel}>Distance</Text>
            <Text style={styles.routeSummaryValue}>
              {routeSummary.distanceText}
            </Text>
          </View>
          <View style={styles.routeSummaryDivider} />
          <View style={styles.routeSummaryRow}>
            <Text style={styles.routeSummaryLabel}>ETA</Text>
            <Text style={styles.routeSummaryValue}>{routeSummary.etaText}</Text>
          </View>
        </View>
      ) : null}

      <Pressable
        style={[styles.floatingActionButton, { bottom: recenterBottomOffset }]}
        onPress={handleRecenterPress}
        hitSlop={10}
      >
        <MaterialIcons name="center-focus-strong" size={22} color="#2563EB" />
      </Pressable>

      <Pressable
        style={[
          styles.floatingActionButton,
          {
            bottom: recenterBottomOffset + 56,
            backgroundColor: "rgba(255, 255, 255, 0.92)",
          },
        ]}
        onPress={handleUseCurrentLocationPress}
        hitSlop={10}
      >
        {isSettingOriginFromLocation ? (
          <ActivityIndicator size="small" color="#2563EB" />
        ) : (
          <MaterialIcons name="my-location" size={20} color="#2563EB" />
        )}
      </Pressable>
    </View>
  );
}

const providerStyles = StyleSheet.create({
  row: {
    gap: 10,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  segmented: {
    flexDirection: "row",
    backgroundColor: "rgba(17, 24, 39, 0.06)",
    borderRadius: 14,
    padding: 3,
    gap: 6,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: "center",
  },
  segmentActive: {
    backgroundColor: "#111827",
  },
  segmentText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
  },
  segmentTextActive: {
    color: "#fff",
  },
  inlineButton: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: "#111827",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  inlineButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
});

const panelStyles = StyleSheet.create({
  bannerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bannerHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});

const pickStyles = StyleSheet.create({
  crosshair: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  crosshairOuter: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "rgba(17, 24, 39, 0.75)",
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  crosshairInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#111827",
  },
  pickerSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    marginHorizontal: 12,
    marginBottom: 12,
    paddingTop: 12,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderRadius: 20,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    elevation: 6,
  },
  pickerActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  pickerButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
