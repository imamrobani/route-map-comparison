import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import WebView, { type WebViewMessageEvent } from "react-native-webview";

type LatLng = {
  latitude: number;
  longitude: number;
};

type LeafletBridgeMessage =
  | {
      type: "ready";
      version: string;
    }
  | {
      type: "error";
      message: string;
    };

type LeafletBridgeCommand =
  | {
      type: "setCenter";
      payload: {
        latitude: number;
        longitude: number;
        zoom?: number;
      };
    }
  | {
      type: "setUserLocation";
      payload: {
        latitude: number;
        longitude: number;
        center?: boolean;
        zoom?: number;
      };
    }
  | {
      type: "zoomIn";
      payload?: {
        delta?: number;
      };
    }
  | {
      type: "zoomOut";
      payload?: {
        delta?: number;
      };
    }
  | {
      type: "setMarkers";
      payload: {
        origin?: {
          latitude: number;
          longitude: number;
        };
        destination?: {
          latitude: number;
          longitude: number;
        };
      };
    }
  | {
      type: "fitMarkers";
      payload: {
        padding?: number;
      };
    }
  | {
      type: "setRoute";
      payload: {
        coordinates: { latitude: number; longitude: number }[];
        fit?: boolean;
        padding?: number;
      };
    }
  | {
      type: "clearRoute";
    };

function buildLeafletHtml({
  initialCenter,
  initialZoom,
}: {
  initialCenter: LatLng;
  initialZoom: number;
}) {
  const safeLat = Number.isFinite(initialCenter.latitude)
    ? initialCenter.latitude
    : -6.21462;
  const safeLng = Number.isFinite(initialCenter.longitude)
    ? initialCenter.longitude
    : 106.84513;
  const safeZoom = Number.isFinite(initialZoom) ? initialZoom : 13;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
    />
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
      crossorigin=""
    />
    <style>
      html, body { height: 100%; width: 100%; margin: 0; padding: 0; }
      #map { height: 100%; width: 100%; background: #0b1220; }
      .leaflet-control-attribution { font-size: 10px; }
    </style>
  </head>
  <body>
    <div id="map"></div>

    <script
      src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
      crossorigin=""
    ></script>
    <script>
      (function () {
        window.__userMarker = null;
        window.__originMarker = null;
        window.__destinationMarker = null;
        window.__routeLine = null;

        function createColoredMarkerIcon(kind) {
          var color = kind === 'destination' ? '#F97316' : '#2563EB';
          var svg =
            '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="48" viewBox="0 0 32 48">' +
            '<path d="M16 46C16 46 30 31.5 30 18C30 10.3 23.7 4 16 4C8.3 4 2 10.3 2 18C2 31.5 16 46 16 46Z" fill="' +
            color +
            '" stroke="rgba(255,255,255,0.98)" stroke-width="2"/>' +
            '<circle cx="16" cy="18" r="6" fill="rgba(255,255,255,0.96)"/>' +
            '</svg>';

          var url = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
          return L.icon({
            iconUrl: url,
            iconRetinaUrl: url,
            iconSize: [26, 40],
            iconAnchor: [13, 40],
            popupAnchor: [0, -36],
          });
        }

        function postMessage(payload) {
          try {
            window.ReactNativeWebView.postMessage(JSON.stringify(payload));
          } catch (e) {
          }
        }

        function safeParse(data) {
          try {
            return JSON.parse(data);
          } catch {
            return null;
          }
        }

        function handleBridgeMessage(event) {
          var raw = event && event.data ? event.data : null;
          if (!raw) return;
          var msg = safeParse(raw);
          if (!msg || typeof msg !== 'object') return;

          if (msg.type === 'setCenter' && msg.payload) {
            var lat = Number(msg.payload.latitude);
            var lng = Number(msg.payload.longitude);
            var zoom = typeof msg.payload.zoom === 'number' ? msg.payload.zoom : undefined;
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
              map.setView([lat, lng], zoom ?? map.getZoom(), { animate: true });
            }
          }

          if (msg.type === 'setUserLocation' && msg.payload) {
            var lat2 = Number(msg.payload.latitude);
            var lng2 = Number(msg.payload.longitude);
            var center = Boolean(msg.payload.center);
            var zoom2 = typeof msg.payload.zoom === 'number' ? msg.payload.zoom : undefined;
            if (!Number.isFinite(lat2) || !Number.isFinite(lng2)) return;

            if (!window.__userMarker) {
              window.__userMarker = L.circleMarker([lat2, lng2], {
                radius: 8,
                color: '#2563EB',
                weight: 3,
                opacity: 0.9,
                fillColor: 'rgba(37, 99, 235, 0.35)',
                fillOpacity: 1,
              }).addTo(map);
            } else {
              window.__userMarker.setLatLng([lat2, lng2]);
            }

            if (center) {
              map.setView([lat2, lng2], zoom2 ?? Math.max(map.getZoom(), 14), { animate: true });
            }
          }

          if (msg.type === 'zoomIn') {
            var deltaIn = msg.payload && typeof msg.payload.delta === 'number' ? msg.payload.delta : 1;
            map.zoomIn(deltaIn);
          }

          if (msg.type === 'zoomOut') {
            var deltaOut = msg.payload && typeof msg.payload.delta === 'number' ? msg.payload.delta : 1;
            map.zoomOut(deltaOut);
          }

          if (msg.type === 'setMarkers' && msg.payload) {
            var origin = msg.payload.origin;
            var destination = msg.payload.destination;

            if (origin && Number.isFinite(Number(origin.latitude)) && Number.isFinite(Number(origin.longitude))) {
              var oLat = Number(origin.latitude);
              var oLng = Number(origin.longitude);
              if (!window.__originMarker) {
                window.__originMarker = L.marker([oLat, oLng], { icon: createColoredMarkerIcon('origin') }).addTo(map);
              } else {
                window.__originMarker.setLatLng([oLat, oLng]);
              }
            } else if (window.__originMarker) {
              map.removeLayer(window.__originMarker);
              window.__originMarker = null;
            }

            if (destination && Number.isFinite(Number(destination.latitude)) && Number.isFinite(Number(destination.longitude))) {
              var dLat = Number(destination.latitude);
              var dLng = Number(destination.longitude);
              if (!window.__destinationMarker) {
                window.__destinationMarker = L.marker([dLat, dLng], { icon: createColoredMarkerIcon('destination') }).addTo(map);
              } else {
                window.__destinationMarker.setLatLng([dLat, dLng]);
              }
            } else if (window.__destinationMarker) {
              map.removeLayer(window.__destinationMarker);
              window.__destinationMarker = null;
            }
          }

          if (msg.type === 'fitMarkers') {
            var padding = msg.payload && typeof msg.payload.padding === 'number' ? msg.payload.padding : 48;
            var points = [];
            if (window.__originMarker) points.push(window.__originMarker.getLatLng());
            if (window.__destinationMarker) points.push(window.__destinationMarker.getLatLng());
            if (points.length === 0) return;
            if (points.length === 1) {
              map.setView(points[0], Math.max(map.getZoom(), 14), { animate: true });
              return;
            }

            var bounds = L.latLngBounds(points);
            map.fitBounds(bounds, { padding: [padding, padding], animate: true });
          }

          if (msg.type === 'setRoute' && msg.payload && Array.isArray(msg.payload.coordinates)) {
            var coords = msg.payload.coordinates
              .map(function (c) {
                return [Number(c.latitude), Number(c.longitude)];
              })
              .filter(function (c) {
                return Number.isFinite(c[0]) && Number.isFinite(c[1]);
              });

            if (coords.length < 2) return;

            if (!window.__routeLine) {
              window.__routeLine = L.polyline(coords, {
                color: '#2563EB',
                weight: 5,
                opacity: 0.9,
                lineJoin: 'round',
                lineCap: 'round',
              }).addTo(map);
            } else {
              window.__routeLine.setLatLngs(coords);
            }

            if (msg.payload.fit) {
              var padding2 = typeof msg.payload.padding === 'number' ? msg.payload.padding : 56;
              map.fitBounds(window.__routeLine.getBounds(), { padding: [padding2, padding2], animate: true });
            }
          }

          if (msg.type === 'clearRoute') {
            if (window.__routeLine) {
              map.removeLayer(window.__routeLine);
              window.__routeLine = null;
            }
          }
        }

        var map;
        try {
          map = L.map('map', {
            zoomControl: false,
            attributionControl: true,
            touchZoom: true,
            scrollWheelZoom: true,
            doubleClickZoom: true,
          }).setView([${safeLat}, ${safeLng}], ${safeZoom});

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
          }).addTo(map);

          window.addEventListener('message', handleBridgeMessage);
          document.addEventListener('message', handleBridgeMessage);

          postMessage({ type: 'ready', version: L.version });
        } catch (e) {
          postMessage({ type: 'error', message: String(e && e.message ? e.message : e) });
        }
      })();
    </script>
  </body>
</html>`;
}

export function LeafletMapView({
  initialCenter = { latitude: -6.21462, longitude: 106.84513 },
  initialZoom = 13,
  userLocation,
  centerOnUserLocation,
  origin,
  destination,
  shouldFitMarkers,
  route,
  shouldFitRoute,
  onReady,
  onError,
}: {
  initialCenter?: LatLng;
  initialZoom?: number;
  userLocation?: LatLng | null;
  centerOnUserLocation?: boolean;
  origin?: LatLng | null;
  destination?: LatLng | null;
  shouldFitMarkers?: boolean;
  route?: LatLng[] | null;
  shouldFitRoute?: boolean;
  onReady?: (payload: { version: string }) => void;
  onError?: (payload: { message: string }) => void;
}) {
  const webViewRef = useRef<WebView>(null);
  const queuedMessagesRef = useRef<string[]>([]);
  const [isBridgeReady, setIsBridgeReady] = useState(false);

  const html = useMemo(
    () => buildLeafletHtml({ initialCenter, initialZoom }),
    [initialCenter, initialZoom],
  );

  const handleMessage = (event: WebViewMessageEvent) => {
    const raw = event.nativeEvent.data;
    let message: LeafletBridgeMessage | null = null;
    try {
      message = JSON.parse(raw) as LeafletBridgeMessage;
    } catch {
      message = null;
    }

    if (!message) return;
    if (message.type === "ready") {
      setIsBridgeReady(true);
      onReady?.({ version: message.version });

      const queued = queuedMessagesRef.current;
      queuedMessagesRef.current = [];
      for (const item of queued) {
        webViewRef.current?.postMessage(item);
      }
    }
    if (message.type === "error") onError?.({ message: message.message });
  };

  const postCommand = (command: LeafletBridgeCommand) => {
    const payload = JSON.stringify(command);
    if (!isBridgeReady) {
      queuedMessagesRef.current.push(payload);
      return;
    }

    webViewRef.current?.postMessage(payload);
  };

  const lastUserLocationRef = useRef<LatLng | null>(null);
  useEffect(() => {
    if (!userLocation) return;

    const last = lastUserLocationRef.current;
    if (
      last &&
      last.latitude === userLocation.latitude &&
      last.longitude === userLocation.longitude &&
      !centerOnUserLocation
    ) {
      return;
    }

    lastUserLocationRef.current = userLocation;
    postCommand({
      type: "setUserLocation",
      payload: {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        center: Boolean(centerOnUserLocation),
      },
    });
  }, [centerOnUserLocation, userLocation]);

  const lastMarkersRef = useRef<{
    origin: LatLng | null;
    destination: LatLng | null;
  }>({ origin: null, destination: null });

  useEffect(() => {
    const nextOrigin = origin ?? null;
    const nextDestination = destination ?? null;

    const last = lastMarkersRef.current;
    if (
      last.origin?.latitude === nextOrigin?.latitude &&
      last.origin?.longitude === nextOrigin?.longitude &&
      last.destination?.latitude === nextDestination?.latitude &&
      last.destination?.longitude === nextDestination?.longitude
    ) {
      return;
    }

    lastMarkersRef.current = {
      origin: nextOrigin,
      destination: nextDestination,
    };
    postCommand({
      type: "setMarkers",
      payload: {
        origin: nextOrigin
          ? { latitude: nextOrigin.latitude, longitude: nextOrigin.longitude }
          : undefined,
        destination: nextDestination
          ? {
              latitude: nextDestination.latitude,
              longitude: nextDestination.longitude,
            }
          : undefined,
      },
    });

    if (shouldFitMarkers) {
      postCommand({
        type: "fitMarkers",
        payload: { padding: 56 },
      });
    }
  }, [destination, origin, shouldFitMarkers]);

  const lastRouteSignatureRef = useRef<string | null>(null);
  useEffect(() => {
    if (!route || route.length < 2) {
      if (lastRouteSignatureRef.current) {
        lastRouteSignatureRef.current = null;
        postCommand({ type: "clearRoute" });
      }
      return;
    }

    const first = route[0];
    const last = route[route.length - 1];
    const signature = `${route.length}:${first.latitude},${first.longitude}:${last.latitude},${last.longitude}`;
    if (signature === lastRouteSignatureRef.current && !shouldFitRoute) return;
    lastRouteSignatureRef.current = signature;

    postCommand({
      type: "setRoute",
      payload: {
        coordinates: route,
        fit: Boolean(shouldFitRoute),
        padding: 72,
      },
    });
  }, [route, shouldFitRoute]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        originWhitelist={["*"]}
        onMessage={handleMessage}
        setSupportMultipleWindows={false}
        bounces={false}
        javaScriptEnabled
        allowsInlineMediaPlayback
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b1220",
  },
});
