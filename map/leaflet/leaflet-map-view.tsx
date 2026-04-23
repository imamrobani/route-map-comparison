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
              window.__userMarker = L.marker([lat2, lng2]).addTo(map);
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
  onReady,
  onError,
}: {
  initialCenter?: LatLng;
  initialZoom?: number;
  userLocation?: LatLng | null;
  centerOnUserLocation?: boolean;
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
