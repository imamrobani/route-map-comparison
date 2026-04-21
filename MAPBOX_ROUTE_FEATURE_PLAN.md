# 🗺️ Mapbox Route Feature – Vibe Coding Plan (Complete)

---

# 🎯 Goal

Membuat fitur:

- Input lokasi A & B (autocomplete)
- Menampilkan marker A & B
- Menampilkan rute jalan (polyline)
- Menampilkan ETA & distance

---

# 🧱 Phase 0 — Project Setup

## Objective

Menyiapkan project Expo + Mapbox

## Tasks

- Install dependency:
  - @rnmapbox/maps
  - expo-location
  - axios

- Setup Mapbox token (.env)
- Jalankan:

  ```bash
  expo prebuild
  ```

- Setup Android & iOS config

## Validation

- Map tampil tanpa error
- Token terbaca dengan benar

## Output

- Mapbox MapView berhasil render

---

# 🧠 Global State (Digunakan di semua phase)

Gunakan state minimal:

```ts
origin: Coordinate | null;
destination: Coordinate | null;
route: Route | null;
isLoading: boolean;
error: string | null;
```

---

# 🗺️ Phase 1 — Basic Map View

## Objective

Menampilkan map + user location

## Tasks

- Request permission lokasi
- Ambil current location
- Render MapView
- Center ke user location

## Validation

- Permission handling benar
- Jika user deny → tampil fallback UI

## Output

- Map + user location tampil

---

# 📍 Phase 2 — Input Lokasi (Autocomplete)

## Objective

User bisa mencari lokasi A & B

## Tasks

- Buat 2 input:
  - Origin
  - Destination

- Integrasi Mapbox Geocoding API
- Tambahkan debounce (300–500ms)
- Minimum 3 karakter sebelum request
- Tampilkan dropdown suggestion

## Validation

- Tidak request jika < 3 karakter
- Tidak spam API (debounce jalan)
- Handle empty result

## State Update

- Set `origin` / `destination`

## Output

- User bisa pilih lokasi valid

---

# 📌 Phase 3 — Marker A & B

## Objective

Menampilkan titik lokasi di map

## Tasks

- Render marker origin & destination
- Jika keduanya ada → fit bounds

## Validation

- Marker tidak render jika null
- Map tidak crash saat state kosong

## Output

- Marker tampil sesuai input

---

# 🧭 Phase 4 — Routing (Polyline)

## Objective

Menampilkan rute jalan dari A ke B

## Tasks

- Call Mapbox Directions API
- Ambil:
  - geometry
  - duration
  - distance

- Render route (LineLayer)

## Validation

- ❗ Jangan call API jika:
  - origin belum ada
  - destination belum ada

- Handle error:
  - No route found
  - API error

- Handle loading state

## State Update

- set `route`
- set `isLoading`
- set `error` jika gagal

## Output

- Rute jalan tampil di map

---

# ⏱️ Phase 5 — ETA & Distance

## Objective

Menampilkan informasi perjalanan

## Tasks

- Format duration → menit
- Format distance → km
- Tampilkan di UI (card / bottom)

## Validation

- Tidak render jika route null
- Format tidak NaN / undefined

## Output

- ETA & distance tampil

---

# 🔄 Phase 6 — Refactor & Abstraction

## Objective

Merapikan code agar scalable

## Tasks

- Buat struktur:

```
/services
  mapbox.service.ts

/hooks
  usePlaces.ts
  useDirections.ts
```

- Pisahkan logic API
- Centralize error handling

## Validation

- Tidak ada logic API di component
- Hook reusable

## Output

- Code clean & maintainable

---

# 🚀 Phase 7 — Enhancement (Optional)

## Optional Features

- Swap lokasi A ↔ B
- Re-center map button
- Current location button
- Loading skeleton
- Basic caching result

---

# 📊 API Reference

## Geocoding (Autocomplete)

```bash
https://api.mapbox.com/geocoding/v5/mapbox.places/{query}.json
```

## Directions

```bash
https://api.mapbox.com/directions/v5/mapbox/driving/{lng1},{lat1};{lng2},{lat2}
```

---

# ⚠️ Global Validations

- Jangan call Directions jika:
  - origin == null
  - destination == null

- Debounce input search

- Minimum input:
  - ≥ 3 karakter

- Handle:
  - API error
  - Empty response
  - Network error

---

# 🧾 Definition of Done

✅ User bisa:

- Input lokasi A & B
- Melihat suggestion
- Memilih lokasi
- Melihat marker
- Melihat rute jalan
- Melihat ETA & distance

---

# 🧠 Development Notes

- Fokus ke flow dulu, bukan UI perfect
- Hindari over-engineering di awal
- Gunakan logging untuk debugging
- Monitor API usage (free tier)

---

# 🔥 Suggested Commit Flow

- feat: setup mapbox
- feat: add map view + location
- feat: autocomplete origin/destination
- feat: render markers
- feat: add directions route
- feat: show eta and distance
- refactor: extract services & hooks

---
