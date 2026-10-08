# Territory Run

Territory Run is a running game where completing a closed loop claims the enclosed land as your territory. The Week 1 foundation includes a PostgreSQL/PostGIS backend, JWT authentication, and an Expo mobile authentication flow.

## Stack

- **Mobile:** Expo SDK 57, Expo Router, React Native, TypeScript, and Expo SecureStore.
- **Server:** Node.js, Express, TypeScript, PostgreSQL via `pg`, Zod, bcrypt, JWT, Helmet, and CORS.
- **Database:** PostgreSQL 16 with PostGIS, started through Docker Compose.
- **Migrations:** `node-pg-migrate` using raw SQL.

## Prerequisites

- Node.js LTS and npm
- Docker Desktop
- Git
- An Android phone or emulator for mobile testing
- The phone and computer must be on the same network when using a physical device.

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

Copy the mobile environment template, then replace the LAN IP placeholder:

```powershell
Copy-Item .env.example .env
```

macOS/Linux alternative:

```bash
cp .env.example .env
```

The mobile API URL is configured in `mobile/.env`:

```dotenv
EXPO_PUBLIC_API_URL=http://<YOUR-PC-LAN-IP>:4000
```

On Windows, run `ipconfig` and read the IPv4 Address of the Wi-Fi adapter. On macOS/Linux, use `ifconfig` or `ip addr`. Replace `<YOUR-PC-LAN-IP>` with that address when testing on a physical phone. For an Android emulator, use:

```dotenv
EXPO_PUBLIC_API_URL=http://10.0.2.2:4000
```

Do not commit `mobile/.env`.

From the mobile directory:

```powershell
cd mobile
npm install
npm run lint
npx tsc --noEmit
npx expo start
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
| `EXPO_PUBLIC_API_URL` | `http://<YOUR-PC-LAN-IP>:4000` | Base URL used by the mobile API client for authentication requests. |

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
│  └─ Territory Run_ Week 1 Guide.md
├─ mobile/
│  ├─ src/app/       # Expo Router screens
│  ├─ src/context/   # Authentication/session state
│  └─ src/lib/       # API client and SecureStore helpers
├─ server/
│  ├─ migrations/
│  └─ src/
│     ├─ config/
│     ├─ controllers/
│     ├─ db/
│     ├─ middleware/
│     ├─ routes/
│     └─ services/
└─ sql-practice/       # PostGIS practice queries
```

## Troubleshooting

- **Phone cannot reach the API:** Confirm the phone and computer use the same Wi-Fi, use the computer's LAN IP in `mobile/.env`, and allow port 4000 through the firewall.
- **Android emulator cannot reach `localhost`:** Use `http://10.0.2.2:4000`.
- **Port 5432 is already in use:** Stop the conflicting PostgreSQL service or change the Docker port and the `DATABASE_URL` port together.
- **Port 4000 is already in use:** Stop the other server or set a different `PORT` and update the mobile API URL.
- **Database authentication fails:** Confirm `DATABASE_URL` matches the Docker Compose values. To reset the local database volume, use `docker compose down -v` (this erases all local database data), then `docker compose up -d` and rerun the migration.
- **`DATABASE_URL` or `JWT_SECRET` is missing:** Check `server/.env`; the server validates both variables before starting.

## Status

Week 1 backend and authentication foundation complete:

- PostgreSQL/PostGIS Docker setup
- Reversible users migration
- Register, login, and protected `/auth/me`
- JWT persistence and session restoration in the mobile app
- Mobile logout and 401 handling

Week 1 runs in Expo Go; from Week 2 the app needs an EAS development build.

See the [Week 1 Guide](./docs/Territory%20Run_%20Week%201%20Guide.md) and [PRD and Build Guide](./docs/PRD.md) for the project plan.
