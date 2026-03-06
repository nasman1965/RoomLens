# RoomLensPro 📐

**Professional 360° restoration documentation — replaces DocuSketch, MagicPlan, and PLNAR.**

---

## What It Does

RoomLensPro is a React Native + Expo mobile app for restoration contractors that:

1. **Connects to a 360° camera** (Insta360 X4 / Ricoh Theta) via Wi-Fi using the OSC HTTP protocol — no native SDK needed
2. **Captures room photos** and sends them to an AI backend (AWS ECS Fargate + HorizonNet) to generate a dimensioned SVG/PDF floor plan in under 3 minutes
3. **Maps moisture readings** on the floor plan with IICRC S500 thresholds (Green / Yellow / Red) and day-by-day visit tracking
4. **Captures damage photos** and runs GPT-4o Vision analysis to suggest Xactimate line items
5. **Generates estimate drafts** with selected Xactimate items and one-tap ESX export
6. **Produces a single PDF report** combining floor plan, 360° tour link, moisture map, photos, and estimate

---

## Project Status

| Screen | Status |
|---|---|
| Splash / Auth / Signup / Forgot Password | ✅ Complete |
| Dashboard (stats + recent jobs) | ✅ Complete |
| Jobs list (filter + search) | ✅ Complete |
| New Job (GPS, job type) | ✅ Complete |
| Job Dashboard (4 module tiles) | ✅ Complete |
| 360° Floor Plan (OSC capture + processing) | ✅ Complete |
| Moisture Mapping (pins + IICRC thresholds) | ✅ Complete |
| Damage Photos + AI Analysis | ✅ Complete |
| Estimate Draft (Xactimate items + export) | ✅ Complete |
| Settings | ✅ Complete |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React Native + Expo SDK 52 (Managed Workflow) |
| Navigation | Expo Router v4 (file-based) |
| State | Zustand |
| Backend / Auth / DB | Supabase (PostgreSQL + Storage + Auth) |
| AI Floor Plan | AWS ECS Fargate + HorizonNet (Python) |
| AI Damage Analysis | GPT-4o Vision via Lambda |
| Camera Protocol | OSC HTTP (Google Open Spherical Camera API) |
| PDF Generation | react-native-html-to-pdf / pdfmake (Phase 2) |
| Styling | StyleSheet.create (NativeWind deferred to Phase 2) |
| Icons | @expo/vector-icons (Ionicons) |

---

## Camera Integration

Both cameras use identical OSC HTTP endpoints. Zero native SDK required:

```
Insta360 X4 → Wi-Fi SSID: Insta360_... → IP: 192.168.42.1
Ricoh Theta → Wi-Fi SSID: THETAXX...  → IP: 192.168.1.1
```

Key calls:
- `GET /osc/info` — camera model + state
- `POST /osc/commands/execute { name: 'camera.takePicture' }` — capture
- `POST /osc/commands/status { id }` — poll until `state === 'done'`
- `GET fileUrl` — download JPEG (~8-12 MB)

---

## Database Schema (Supabase)

Tables: `users`, `jobs`, `rooms`, `floor_plan_scans`, `moisture_readings`, `drying_visits`, `damage_photos`, `estimates`, `reports`

Full SQL: `/supabase/schema.sql`

---

## Subscription Model

| Tier | Price | Jobs/Month | Modules |
|---|---|---|---|
| Free | $0 | 3 | Floor plan only |
| Starter | $99 CAD/mo | 20 | All modules |
| Pro | $199 CAD/mo | Unlimited | All + priority support |
| Enterprise | Custom | Unlimited | All + API access |

---

## Setup

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Add: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY

# Run Supabase schema
# Open supabase/schema.sql in Supabase SQL Editor and run it

# Start development
npx expo start
```

---

## Roadmap

### Phase 1 (Current) — MVP ✅
- [x] App shell, auth, job management
- [x] OSC camera integration (Insta360 X4 + Ricoh Theta)
- [x] Floor plan module (capture → AI processing → SVG)
- [x] Moisture mapping with IICRC S500 thresholds
- [x] Damage photos + GPT-4o Vision AI analysis
- [x] Estimate draft with Xactimate line items

### Phase 2 — Backend Integration
- [ ] Connect AWS ECS Fargate for real HorizonNet floor plan processing
- [ ] Wire Supabase Storage for photo upload
- [ ] Real GPT-4o Vision API calls via Lambda
- [ ] PDF report generation (combined floor plan + moisture + photos + estimate)
- [ ] Real Xactimate ESX file export

### Phase 3 — Advanced Features
- [ ] BLE moisture meter integration (Tramex, Protimeter, Delmhorst)
- [ ] Offline mode (expo-sqlite)
- [ ] Background photo sync
- [ ] 360° tour viewer (React Three Fiber)
- [ ] App Store / Play Store submission

---

## GitHub

https://github.com/nasman1965/RoomLens

---

*Built for restoration contractors. Document once. Deliver everything.*
