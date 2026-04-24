# Page Design — Map Screen

## Layout
- Primary layout: **CSS Grid** (desktop-first).
  - Desktop: 2-column layout with a fixed-width left panel and a flexible map area.
    - Left panel: 360–420px (route/search controls + results)
    - Map area: 1fr (full height)
  - Tablet/small screens: collapse left panel into a **bottom sheet** over the map.
- Spacing: 8px grid system (8/16/24/32).
- Alignment: left panel uses vertical stack; map uses full-bleed container.

## Meta Information
- Title: “Map & Routing”
- Description: “Search places, select start and destination, and compute routes using Mapbox or OSRM.”
- Open Graph:
  - og:title: “Map & Routing”
  - og:description: same as description
  - og:type: “website”

## Global Styles
- Background: #0B1220 (app shell) and #0F172A (panels)
- Surface/cards: #111C33 with 1px border #1F2A44
- Text:
  - Primary: #E5E7EB
  - Secondary: #9CA3AF
- Accent:
  - Primary action: #3B82F6
  - Success/route highlight: #22C55E
  - Danger/error: #EF4444
- Typography scale:
  - H1: 20px/28px, Semibold
  - H2: 16px/24px, Semibold
  - Body: 14px/20px, Regular
  - Caption: 12px/16px, Regular
- Buttons:
  - Primary: solid accent, hover darken 8%, disabled 40% opacity
  - Secondary: outline border #334155, hover background #16233E
- Links: underline on hover
- Inputs:
  - Height 40px, radius 10px, focus ring 2px #3B82F6

## Page Structure
1. App Top Bar (optional if app already has global nav)
2. Main Content Grid
   - Left Control Panel
   - Map Canvas

## Sections & Components

### 1) Top Bar (Optional)
- Left: Screen title “Map”
- Right: “Help” / “Clear” action (if consistent with your app patterns)

### 2) Left Control Panel (Desktop)
A stacked panel with these blocks, top to bottom:

#### 2.1 Location Inputs
- **Start input**
  - Text field with placeholder “Choose start location”
  - Leading icon: pin
  - Trailing actions: “Use my location” (if available), clear input
- **Destination input**
  - Text field with placeholder “Choose destination”
  - Trailing action: clear
- **Swap button**
  - Small icon button between fields to swap start/destination

#### 2.2 Autocomplete Results (Nominatim)
- Appears as a dropdown under the active input.
- Each row:
  - Primary label: place name
  - Secondary label: address/context
- States:
  - Loading: skeleton rows
  - Empty: “No matches found”
  - Error: “Search failed” + retry

#### 2.3 Routing Provider Switch
- Segmented control labeled “Routing Provider”
  - Options: **Mapbox** (default selected), **OSRM**
- Helper text:
  - “Mapbox is default. Switching provider recalculates the route.”

#### 2.4 Route Actions
- Primary button: “Calculate Route” (enabled when both points are set)
- Secondary button: “Clear Route”
- Optional toggle: “Follow route on map” (keeps route centered)

#### 2.5 Route Summary
- Card showing:
  - Distance (km/mi)
  - Duration (min)
  - Provider badge (Mapbox/OSRM)
- Error states:
  - “Route unavailable” + retry

### 3) Map Canvas (Mapbox)
- Full-height, full-bleed map container.
- Controls (top-right): zoom in/out, compass (optional).
- User location indicator (only if permission granted).
- Route rendering:
  - Polyline with high-contrast stroke (e.g., #22C55E) and outline/shadow for visibility.
  - Start marker and destination marker with distinct colors.
- Map interactions:
  - Tap/long-press to set start/destination (choose via a small contextual menu: “Set as Start” / “Set as Destination”).

## Responsive Behavior
- <= 900px width:
  - Left panel becomes a bottom sheet:
    - Collapsed: shows Start/Destination summary + provider switch.
    - Expanded: shows full inputs, autocomplete list, route actions, and summary.
  - Map remains interactive behind the sheet.

## Interaction & Transition Guidelines
- Autocomplete dropdown: 120–180ms ease-out fade/slide.
- Bottom sheet: 180–220ms spring-like transition.
- Provider switch: immediate visual toggle; route recalculation shows an inline loading state on summary card and a subtle progress indicator on map (e.g., thin top bar).