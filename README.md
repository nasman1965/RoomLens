# RoomLensPro

Professional restoration documentation app for iOS & Android, built with Expo + React Native.

---

## ✅ Completed Features (Phase 1 — MVP Shell)

### Auth
- Splash screen with auto-session detection (Firebase AsyncStorage persistence)
- Email + password sign-up (creates Firestore user profile)
- Sign-in with friendly error messages
- Forgot-password (Firebase email reset)
- Persistent login across app restarts

### Navigation
- 4-tab bottom bar: **Home · Floor Plan · Moisture · Large Loss**
- Job-specific screens accessible via deep links from job dashboard tiles

### Screens (7 core)
| Screen | Route | Description |
|---|---|---|
| Dashboard | `/(tabs)/` | Stats row, recent jobs, New Job CTA |
| Floor Plan | `/(tabs)/floor-plan` | OSC camera how-to, active job list |
| Moisture Map | `/(tabs)/moisture-map` | IICRC S500 legend + threshold card |
| Large Loss | `/(tabs)/large-loss` | Rapid photo capture, floor/area tagging |
| Jobs | `/(tabs)/jobs` | Search, filter by status, pull-to-refresh |
| New Job | `/job/new` | Address + GPS auto-fill, job-type chips |
| Job Dashboard | `/job/[id]` | 4 module tiles, status selector |
| Settings | `/settings` | Profile, subscription, sign-out |

### Modules (4 deep screens)
| Module | Route |
|---|---|
| 360° Floor Plan capture | `/floorplan/[jobId]` |
| Moisture mapping | `/moisture/[jobId]` |
| Damage photos + AI | `/photos/[jobId]` |
| Estimate review | `/estimate/[jobId]` |

---

## 🔥 Backend: Firebase (Free Spark Plan)

**Why Firebase?** No cost until large scale, no project pausing, excellent React Native SDK.

| Service | Usage |
|---|---|
| Firebase Auth | Email/password, session persistence via AsyncStorage |
| Firestore | `users/{uid}` profiles, `jobs/{jobId}` job records |
| Firebase Storage | Photos, floor plan PDFs (coming Sprint 2) |

**Free limits (Spark plan):**
- Auth: unlimited users
- Firestore: 50K reads / 20K writes / 20K deletes per day
- Storage: 5 GB total, 1 GB/day download

---

## ⚙️ Setup Instructions

### 1. Firebase Project (≈ 10 min)

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. **Create project** → name it `roomlenspro`
3. **Add Web app** → copy the `firebaseConfig` values
4. **Authentication** → Sign-in method → Enable **Email/Password**
5. **Firestore Database** → Create database → Production mode → choose nearest region
6. **Storage** → Get started (for future photo uploads)

### 2. Environment Variables

```bash
cp .env.example .env
# Edit .env with your Firebase config values
```

### 3. Install & Run

```bash
npm install
npx expo start
# Scan QR code with Expo Go (iOS / Android)
```

### 4. Firestore Security Rules (paste in Firebase Console)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own profile
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    // Jobs scoped to owner
    match /jobs/{jobId} {
      allow read, write: if request.auth != null
        && (resource == null || resource.data.user_id == request.auth.uid)
        && request.resource.data.user_id == request.auth.uid;
    }
  }
}
```

---

## 🗂 Data Models

### User (`users/{uid}`)
```typescript
{
  id:                string;
  email:             string;
  company_name:      string;
  subscription_tier: 'free' | 'starter' | 'pro' | 'enterprise';
  created_at:        Timestamp;
}
```

### Job (`jobs/{jobId}`)
```typescript
{
  id:               string;      // Firestore doc ID
  user_id:          string;      // owner UID
  property_address: string;
  gps_lat?:         number;
  gps_lng?:         number;
  job_type:         'water_loss' | 'fire_loss' | 'mold' | 'large_loss' | 'other';
  status:           'draft' | 'active' | 'complete' | 'invoiced';
  notes?:           string;
  created_at:       Timestamp;
}
```

---

## 📦 Tech Stack

| Layer | Technology |
|---|---|
| Mobile Framework | Expo 52 + React Native 0.76 |
| Navigation | Expo Router (file-based) |
| Backend / Auth | Firebase 11 (Firestore + Auth + Storage) |
| State Management | Zustand |
| Styling | React Native StyleSheet (design tokens in `src/constants/theme.ts`) |
| Camera OSC | Plain `fetch()` to `http://192.168.42.1/osc/commands/execute` |

---

## 🛣 Roadmap

| Sprint | Weeks | Goal |
|---|---|---|
| ✅ Phase 1 | 1–2 | App shell, auth, 4-tab navigation |
| Phase 2 | 3–5 | OSC camera capture, Firebase Storage upload, floor-plan AI (AWS ECS Fargate) |
| Phase 3 | 6–7 | Moisture map Firestore persistence, BLE manual entry |
| Phase 4 | 8–9 | Damage photo log, GPT-4o Vision analysis, Xactimate estimate draft |
| Phase 5 | 10–14 | Offline mode, PDF report, beta testing, App Store submission |

---

## 🔗 Links

- **GitHub**: https://github.com/nasman1965/RoomLens
- **Platform**: iOS + Android (Expo Bare workflow target)
- **Status**: ✅ Phase 1 complete — ready for Expo Go testing

---

*Last updated: March 2026 — Firebase migration complete, 0 TypeScript errors.*
