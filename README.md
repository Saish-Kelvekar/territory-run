# Territory Run

Territory Run is a running game where completing a closed loop claims the enclosed land as your territory. The Week 1 foundation includes a PostgreSQL/PostGIS backend, JWT authentication, and an Expo mobile authentication flow. Week 2 adds live GPS tracking, MapLibre map rendering, and run loop detection via an EAS development build.

## Stack

- **Mobile:** Expo SDK 57, Expo Router, React Native, TypeScript, Expo SecureStore, Expo Location, and MapLibre React Native (`@maplibre/maplibre-react-native`).
- **Server:** Node.js, Express, TypeScript, PostgreSQL via `pg`, Zod, bcrypt, JWT, Helmet, and CORS.
- **Database:** PostgreSQL 16 with PostGIS, started through Docker Compose.
- **Migrations:** `node-pg-migrate` using raw SQL.

## Prerequisites

- Node.js LTS and npm
- Docker Desktop
- Git
- EAS CLI (`npm install -g eas-cli`) and an Expo account (for EAS builds)
- An Android device with the custom development build installed, or an Android emulator
- When testing on a physical device, the phone and computer must be on the same network to connect to the local Metro dev server.

## Setup

### 1. Start PostgreSQL and PostGIS

From the repository root:

```powershell
docker compose up -d
```

These local-development-only credentials come from `docker-compose.yml`:

```text
Host: localhost
Port: 5432
Database: territory_run
User: territory
Password: territory_pw
```

### 2. Configure and start the server

```powershell
cd server
Copy-Item .env.example .env
```

Open `server/.env` and provide your local values:

```dotenv
PORT=4000
DATABASE_URL=postgres://territory:territory_pw@localhost:5432/territory_run
JWT_SECRET=replace-this-with-a-random-secret-at-least-32-characters
```

`JWT_SECRET` must be at least 32 characters. Use a private random value for real development or deployment. Never commit `server/.env`.

Generate a JWT secret with Node.js and paste the output as `JWT_SECRET`:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Install dependencies, apply the migration, and start the development server:

```powershell
npm install
npm run migrate -- up
npm run dev
```

The server listens on `http://localhost:4000`.

Open `http://localhost:4000/health` and expect `{"ok":true,"db":"up"}`.

To build and run the compiled server:

```powershell
npm run build
npm start
```

### 3. Configure and start the mobile app

Because the app uses native MapLibre modules, running it requires an **EAS development build** (APK) installed on your device instead of standard Expo Go.

Copy the mobile environment template:

```powershell
cd mobile
Copy-Item .env.example .env
```

macOS/Linux alternative:

```bash
cd mobile
cp .env.example .env
```

#### Configuring the Backend API URL

The mobile API client reads `EXPO_PUBLIC_API_URL` from `mobile/.env`. Set it to your desired backend endpoint:

- **Local backend on physical device (same Wi-Fi):**
  ```dotenv
  EXPO_PUBLIC_API_URL=http://<YOUR-PC-LAN-IP>:4000
  ```
  On Windows, run `ipconfig` and read the IPv4 Address of the Wi-Fi adapter. On macOS/Linux, use `ifconfig` or `ip addr`.
- **Local backend on Android emulator:**
  ```dotenv
  EXPO_PUBLIC_API_URL=http://10.0.2.2:4000
  ```
- **Hosted backend (Render):**
  ```dotenv
  EXPO_PUBLIC_API_URL=https://territory-run-api-2bc1.onrender.com
  ```

> **Important distinction:**
> - **Expo Metro Bundler URL** (`exp://<YOUR-PC-LAN-IP>:8081`): The address printed by Expo CLI in the terminal when you start the dev server. The development build connects here to download JavaScript bundles and hot-reload.
> - **Backend API URL (`EXPO_PUBLIC_API_URL`)**: The HTTP/HTTPS endpoint used by the mobile application code to send API and authentication requests to the Express server (local port 4000 or hosted Render backend).

Do not commit `mobile/.env`.

#### Running the Mobile App

Install dependencies and start the Metro bundler with the development client flag:

```powershell
cd mobile
npm install
npx expo start --dev-client
```

Open the development build APK on your device, and connect to the local Metro development server (or scan the terminal QR code).

To run locally with prebuild:

```powershell
npm run android   # runs expo run:android
npm run ios       # runs expo run:ios
```

## Verification and Testing

All verification checks can be run from the `mobile/` directory:

```powershell
cd mobile

# Unit tests (Jest + jest-expo)
npm test
# or run in-band:
npx jest --runInBand

# TypeScript type verification
npx tsc --noEmit

# ESLint verification
npm run lint
```

## EAS Build Configuration

The Android development APK is generated with Expo Application Services (EAS). Build profiles are configured in `mobile/eas.json`:

- **`development`:** Internal Android APK (`buildType: "apk"`) with `"developmentClient": true`. Injects `EXPO_PUBLIC_API_URL=https://territory-run-api-2bc1.onrender.com` during cloud builds.
- **`preview`:** Internal distribution APK with the hosted Render backend.
- **`production`:** Production profile with the hosted Render backend.

To build the development client APK:

```powershell
cd mobile
eas build --profile development --platform android
```

## Environment variables

### Server: `server/.env`

| Variable | Example | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | HTTP port used by the Express server. |
| `DATABASE_URL` | `postgres://territory:territory_pw@localhost:5432/territory_run` | PostgreSQL connection string used by the shared `pg` pool and migrations. |
| `JWT_SECRET` | `replace-this-with-a-random-secret-at-least-32-characters` | Secret used to sign and verify 7-day authentication tokens. Must be at least 32 characters. |

### Mobile: `mobile/.env`

| Variable | Example | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | `http://<YOUR-PC-LAN-IP>:4000` or `https://territory-run-api-2bc1.onrender.com` | Base URL used by the mobile API client for authentication requests. |

Only fake values are included in [server/.env.example](./server/.env.example). Real `.env` files must remain local.

## Authentication API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Checks that the server and database are available. |
| `POST` | `/auth/register` | Creates an account and returns a JWT and public user information. |
| `POST` | `/auth/login` | Logs in and returns a JWT and public user information. |
| `GET` | `/auth/me` | Returns the current authenticated user. Requires `Authorization: Bearer <token>`. |

The mobile app stores only the JWT in Expo SecureStore. It never stores passwords or displays `password_hash`.

## Project structure

```text
territory-run/
├─ docker-compose.yml
├─ docs/
│  ├─ PRD.md
│  ├─ Territory Run_ Week 1 Guide.md
│  ├─ Territory_Run_Week_2_Guide.md
│  └─ field-notes.md
├─ mobile/
│  ├─ eas.json
│  ├─ src/app/          # Expo Router screens (home, run, login, register, permission-needed)
│  ├─ src/constants/    # Map style URL and client constants
│  ├─ src/context/      # Authentication/session state
│  ├─ src/hooks/        # Location, permission, and run tracking hooks
│  ├─ src/lib/          # API client and SecureStore helpers
│  ├─ src/types/        # TypeScript interfaces
│  └─ src/utils/        # Geo calculations (Haversine, route distance, GeoJSON)
├─ server/
│  ├─ migrations/
│  └─ src/
│     ├─ config/
│     ├─ controllers/
│     ├─ db/
│     ├─ middleware/
│     ├─ routes/
│     └─ services/
└─ sql-practice/        # PostGIS practice queries
```

## Troubleshooting

- **Phone cannot reach the API:** Confirm the phone and computer use the same Wi-Fi, use the computer's LAN IP in `mobile/.env`, and allow port 4000 through the firewall.
- **Android emulator cannot reach `localhost`:** Use `http://10.0.2.2:4000`.
- **Run screen crashes in standard Expo Go:** MapLibre native code requires an EAS development client build. Use `npx expo start --dev-client` and install the development APK on your device.
- **Map style fails to load / Map is blank:** Ensure device has active internet access and can reach the tile server (`https://tiles.openfreemap.org/styles/liberty`).
- **GPS accuracy filtering:** Points with accuracy worse than 30 m are dropped from the active route line but preserved in raw readings.
- **Port 5432 is already in use:** Stop the conflicting PostgreSQL service or change the Docker port and the `DATABASE_URL` port together.
- **Port 4000 is already in use:** Stop the other server or set a different `PORT` and update the mobile API URL.
- **Database authentication fails:** Confirm `DATABASE_URL` matches the Docker Compose values. To reset the local database volume, use `docker compose down -v` (this erases all local database data), then `docker compose up -d` and rerun the migration.
- **`DATABASE_URL` or `JWT_SECRET` is missing:** Check `server/.env`; the server validates both variables before starting.

## Status

### Week 1: Backend & Authentication Foundation (Complete)
- PostgreSQL 16 + PostGIS Docker setup.
- Reversible users database migration.
- Express API with JWT authentication (register, login, me).
- Mobile authentication client with SecureStore token persistence and session restoration.

### Week 2: Mobile Location, Map & Live Run Tracking (Complete)
- EAS development client configuration with `@maplibre/maplibre-react-native` and `expo-location`.
- Foreground location permission handling (`useLocationPermission`, permission-needed fallback screen).
- MapLibre map on the Run screen centered on user location with OpenFreeMap liberty style and attribution.
- Live GPS tracking (`useLiveLocation`) with 30 m accuracy filtering.
- Run state machine (`useRunTracker`), elapsed duration timer, route distance calculation, and 40 m loop closure detection.
- Unit testing with passing Jest tests for Haversine distance and run tracker reducer (20 passed, 0 failed).
- Real-device outdoor testing completed and documented in [docs/field-notes.md](./docs/field-notes.md).
- Automated test, TypeScript, and lint verification passing with zero errors.

> **Note on Territory Claiming:** Territory capture transactions, database polygon geometry (`ST_Area`, `ST_Difference`, `ST_Union`), and saving runs to the backend are planned for subsequent milestones (Week 6).

See the [Week 1 Guide](./docs/Territory%20Run_%20Week%201%20Guide.md), [Week 2 Guide](./docs/Territory_Run_Week_2_Guide.md), and [PRD](./docs/PRD.md) for the project specifications.
