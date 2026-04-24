## 1.Architecture design

```mermaid
graph TD
  A["User Device / Browser"] --> B["React Frontend Application"]
  B --> C["Mapbox Maps SDK"]
  B --> D["Nominatim Search API"]
  B --> E["Routing Provider (Default: Mapbox)"]
  B --> F["Routing Provider (Optional: OSRM)"]

  subgraph "Frontend Layer"
    B
  end

  subgraph "External Services"
    C
    D
    E
    F
  end
```

## 2.Technology Description
- Frontend: React@18 (or React Native) + Mapbox Maps SDK + TypeScript
- Backend: None

## 3.Route definitions
| Route | Purpose |
|-------|---------|
| /map | Dedicated screen with Mapbox map, Nominatim autocomplete, and routing provider switch (Mapbox default, OSRM optional). |

## 6.Data model(if applicable)
Not required (no persistent storage needed for basic routing/search flow).