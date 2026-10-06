# Territory Run: Week 1 Guide (Oct 5 - Oct 11)

**Goal of the week:** a GitHub repo with a clean structure, PostgreSQL + PostGIS running in Docker, your Week 4 auth backend moved onto Postgres, and your mobile app logging in against it.

**Time:** about 15 hours (weekdays 2 h, weekend 4-5 h). **Rule:** if stuck for more than 1 hour, copy the exact error and your command into an LLM or ask me.

## Final folder structure (end of Week 1)

```
territory-run/
├─ .gitignore
├─ README.md
├─ docker-compose.yml
├─ docs/
│  └─ PRD.md                    (paste the PRD here)
├─ server/
│  ├─ package.json
│  ├─ tsconfig.json
│  ├─ .env                      (NOT committed)
│  ├─ .env.example              (committed)
│  ├─ migrations/
│  │  └─ <timestamp>_init-users.sql
│  └─ src/
│     ├─ server.ts              (starts the app)
│     ├─ app.ts                 (express setup, routes)
│     ├─ config/env.ts
│     ├─ db/pool.ts
│     ├─ middleware/{auth.ts, errorHandler.ts}
│     ├─ routes/auth.routes.ts
│     ├─ controllers/auth.controller.ts
│     └─ services/auth.service.ts
├─ mobile/                      (your Week 4 Expo app, moved here)
│  └─ .env                      (NOT committed; EXPO_PUBLIC_API_URL)
└─ sql-practice/
   └─ postgis-basics.sql        (Day 3 exercises)
```

## Day 1: Tools and GitHub (2 h)

1. Install: Git, Node.js (current LTS), Docker Desktop (on Windows, enable WSL2 when asked), VS Code, DBeaver (database viewer), and Bruno or Postman (API testing).
2. Check: `git --version`, `node -v`, `docker --version`.
3. Set identity: `git config --global user.name "Your Name"` and `git config --global user.email "you@example.com"`.
4. On GitHub, create a **private** repo named `territory-run` (add README, choose Node `.gitignore`). Make it public later when it's presentable.
5. Clone it: `git clone https://github.com/<you>/territory-run.git` and `cd territory-run`.
6. Create the folders: `server`, `mobile`, `docs`, `sql-practice`.
7. Replace `.gitignore` contents with at least:

```
node_modules/
.env
.env.*
!.env.example
dist/
.expo/
*.log
.DS_Store
android/
ios/
```

8. Commit: `git add . && git commit -m "chore: initial repo structure" && git push`.

**Done when:** the repo is on GitHub with the folders (add an empty `.gitkeep` in empty ones).

## Day 2: Postgres + PostGIS in Docker (2 h)

Create `docker-compose.yml` in the repo root:

```yaml
services:
  db:
    image: postgis/postgis:16-3.4
    container_name: territory-db
    environment:
      POSTGRES_USER: territory
      POSTGRES_PASSWORD: territory_pw
      POSTGRES_DB: territory_run
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

1. `docker compose up -d`, then `docker ps` should show `territory-db`.
2. In DBeaver: New Connection, PostgreSQL, host `localhost`, port `5432`, db `territory_run`, user `territory`, password `territory_pw`.
3. Open a SQL editor and run:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
SELECT PostGIS_Version();
```

4. Commit: `feat: add docker compose for postgres + postgis`.

**Done when:** `PostGIS_Version()` returns a version. **If it fails:** Docker not running (start Docker Desktop); port 5432 busy (change the left side to `5433:5432` and use 5433 everywhere).

## Day 3: SQL + PostGIS practice (3 h)

Save as `sql-practice/postgis-basics.sql` and run it piece by piece, reading each result.

```sql
CREATE TABLE sandbox_zones (
  id serial PRIMARY KEY,
  name text NOT NULL,
  geom geometry(Polygon, 4326) NOT NULL
);

INSERT INTO sandbox_zones (name, geom) VALUES
('A', ST_GeomFromText('POLYGON((75.000 15.000, 75.002 15.000, 75.002 15.002, 75.000 15.002, 75.000 15.000))', 4326)),
('B', ST_GeomFromText('POLYGON((75.001 15.001, 75.003 15.001, 75.003 15.003, 75.001 15.003, 75.001 15.001))', 4326));

-- 1. area in square metres (geography cast = real metres)
SELECT name, ST_Area(geom::geography) AS area_m2 FROM sandbox_zones;

-- 2. do they overlap?
SELECT ST_Intersects(a.geom, b.geom) FROM sandbox_zones a, sandbox_zones b
WHERE a.name = 'A' AND b.name = 'B';

-- 3. THE CAPTURE: what is left of A after B takes the overlap?
SELECT ST_Area(ST_Difference(a.geom, b.geom)::geography) AS a_after_capture
FROM sandbox_zones a, sandbox_zones b WHERE a.name = 'A' AND b.name = 'B';

-- 4. B's new territory (its land plus nothing else here)
SELECT ST_Area(ST_Union(a.geom, b.geom)::geography) AS union_area
FROM sandbox_zones a, sandbox_zones b WHERE a.name = 'A' AND b.name = 'B';
```

**Sanity check:** the overlap is a quarter of A, so query 3 should be about 75% of A's area, and query 4 about 175% of A's area. If your numbers match, you understand the core mechanic of the whole app.

Also practice plain SQL on a scratch table: `INSERT`, `UPDATE`, `DELETE`, `JOIN`, `GROUP BY`, `ORDER BY`, `LIMIT`. Commit: `docs: add postgis practice queries`.

## Day 4: Backend skeleton (2 h)

```
cd server
npm init -y
npm i express pg zod bcrypt jsonwebtoken dotenv cors helmet
npm i -D typescript tsx @types/node @types/express @types/pg @types/bcrypt @types/jsonwebtoken @types/cors node-pg-migrate
npx tsc --init
```

In `tsconfig.json` set `"rootDir": "src"`, `"outDir": "dist"`, `"strict": true`. In `package.json` scripts:

```json
"dev": "tsx watch src/server.ts",
"build": "tsc",
"start": "node dist/server.js",
"migrate": "node-pg-migrate --envPath .env"
```

Create `server/.env` (and a copy as `.env.example` with fake values):

```
PORT=4000
DATABASE_URL=postgres://territory:territory_pw@localhost:5432/territory_run
JWT_SECRET=replace-with-a-long-random-string
```

`src/db/pool.ts`:

```ts
import { Pool } from "pg";
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const query = (text: string, params?: unknown[]) => pool.query(text, params);
```

Build `app.ts` (JSON parsing, cors, helmet, `GET /health` returning `{ ok: true }`, error handler) and `server.ts` (load dotenv first, listen on `PORT`). Add one more check: `/health` should also run `SELECT 1` through the pool.

**Done when:** `npm run dev` starts and `GET http://localhost:4000/health` returns ok. Commit: `feat(server): express + ts skeleton with db pool`.

## Day 5: Migrations and the users table (2 h)

1. `npx node-pg-migrate create init-users -j sql` (creates a file in `migrations/`; if a flag differs in your version, check `npx node-pg-migrate --help`).
2. Put this in the file:

```sql
-- Up Migration
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  color text NOT NULL DEFAULT '#3b82f6',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Down Migration
DROP TABLE users;
```

3. Run `npm run migrate up`. Open DBeaver, refresh, and confirm the `users` table and a `pgmigrations` table exist.
4. Test going back with `npm run migrate down`, then `up` again. Knowing a migration can be undone is the point.

Commit: `feat(db): add users migration`.

## Day 6: Port auth to Postgres (2.5 h)

Copy your Week 4 routes and middleware into the structure above. Only the **data layer** changes. Rules:

- Always use parameters (`$1`, `$2`). Never build SQL with string concatenation.
- Register: `INSERT INTO users (email, username, password_hash) VALUES ($1,$2,$3) RETURNING id, email, username;` If Postgres error code is `23505` (unique violation), return 409 with `{ message, code: "EMAIL_OR_USERNAME_TAKEN" }`.
- Login: `SELECT id, email, username, password_hash FROM users WHERE email = $1;` then `bcrypt.compare`. Never return `password_hash`.
- Me: `SELECT id, email, username, color FROM users WHERE id = $1;` behind JWT middleware.
- Validate bodies with Zod. Errors return `{ message, code, fields? }`.

Test all three in Bruno/Postman: register, duplicate register (expect 409), login, `/auth/me` with and without token (expect 401 without).

Commit: `feat(auth): register, login, me on postgres`.

## Day 7: Connect the mobile app and wrap up (3 h)

1. Copy your Week 4 Expo app into `mobile/`. **Delete any `.git` folder inside it** (`mobile/.git`), or Git will treat it as a separate repo.
2. Create `mobile/.env`: `EXPO_PUBLIC_API_URL=http://<your-PC-LAN-IP>:4000` (find it with `ipconfig` on Windows or `ifconfig` on Mac). Emulator: `http://10.0.2.2:4000`. Phone and PC must be on the same Wi-Fi, and your firewall must allow port 4000.
3. Run `npx expo start` and repeat your Week 4 self-test against the new backend (register, login, persisted session, 401 handling, logout).
4. Write `README.md`: what the app is, the stack, and exact setup steps (`docker compose up -d`, `cd server && npm i && npm run migrate up && npm run dev`, `cd mobile && npm i && npx expo start`).
5. Paste the PRD into `docs/PRD.md`.
6. Final commit, then tag: `git tag week-1-done && git push --tags`.

## Commit habits

Small commits, present tense, prefixes `feat`, `fix`, `chore`, `docs`. Work on a branch (`git checkout -b week-1-setup`), open a pull request on GitHub, and merge it yourself at the end of the week. Never commit `.env`. If you ever do, rotate the secret.

## Week 1 definition of done

- [ ] Repo on GitHub with the structure above, `.env` not tracked (`git ls-files | grep .env` shows only `.env.example`)
- [ ] `docker compose up -d` starts Postgres + PostGIS from a clean machine
- [ ] Day 3 queries run and match the sanity check
- [ ] `users` created by a migration, and `migrate down` then `up` works
- [ ] Register, login, me work against Postgres with parameterized queries and proper 409/401 errors
- [ ] Mobile app passes the Week 4 self-test against the new backend
- [ ] README lets a stranger run everything

## Common problems

- **Phone can't reach the API:** wrong IP, different Wi-Fi, or firewall. Test `http://<IP>:4000/health` in the phone's browser first.
- **`password authentication failed`:** `.env` doesn't match `docker-compose.yml`, or an old volume has other credentials (`docker compose down -v` wipes data).
- **`extension "postgis" is not available`:** you're not using the `postgis/postgis` image.
- **`DATABASE_URL` undefined:** dotenv wasn't loaded before the pool was created.

---

# Prompt to paste into another LLM

Copy everything in the block below as your first message. Then work one step at a time and paste your errors back.

```text
You are my patient senior mentor. I am a beginner building my FIRST full app. Guide me step by step; do not dump everything at once.

PROJECT: "Territory Run", a running app. A user runs a closed loop (end point within 40 m of start); the enclosed area becomes their territory. If another user's later loop encloses part of someone's territory, that part is cut out of the victim's territory and added to the new runner. Territory is per week and resets every Monday 00:00 Asia/Kolkata. Two weekly leaderboards: total territory area, and total distance run. Target: Android (iOS-compatible code), ship by end of February to apply for app developer internships.

MY BACKGROUND: good Express + REST + async JS, decent React (useState, useEffect, useContext), basic SQL, learning TypeScript. I have a working Expo + Expo Router + TypeScript app with register/login/protected routes/SecureStore session restore against an Express backend. I want to LEARN PostgreSQL, so use raw SQL, no ORM.

STACK:
- Mobile: Expo, Expo Router, TypeScript, expo-secure-store, later expo-location, expo-task-manager, react-native-maps, TanStack Query, Zustand, React Hook Form + Zod
- Server: Node, Express, TypeScript, pg (node-postgres), node-pg-migrate (SQL migrations), zod, bcrypt, jsonwebtoken, dotenv, cors, helmet
- DB: PostgreSQL 16 + PostGIS via Docker image postgis/postgis:16-3.4
- Monorepo folders: server/, mobile/, docs/, sql-practice/, plus docker-compose.yml at root

CURRENT TASK: WEEK 1 (about 15 hours). Goals, in order:
1. Install tools; create private GitHub repo territory-run with folders and a proper .gitignore (.env never committed, .env.example committed)
2. docker-compose Postgres+PostGIS; connect with DBeaver; run SELECT PostGIS_Version()
3. PostGIS practice: two overlapping polygons; use ST_Area(geom::geography), ST_Intersects, ST_Difference, ST_Union to simulate a capture
4. server/ skeleton: Express + TS, src/{server.ts, app.ts, config, db/pool.ts, middleware, routes, controllers, services}, GET /health that also runs SELECT 1
5. Migration init-users (enable postgis + pgcrypto; users table with uuid id, unique email, unique username, password_hash, color, created_at); test migrate up/down
6. Port register/login/me to Postgres with parameterized queries ($1, $2); unique violation code 23505 returns 409; error shape { message, code, fields? }; never return password_hash
7. Move my Expo app into mobile/ (remove any nested .git), set EXPO_PUBLIC_API_URL to the PC LAN IP (Android emulator uses 10.0.2.2), and verify register, login, session persistence, 401 handling, logout
8. README with exact setup steps; tag week-1-done

HOW TO HELP ME:
- Ask my OS (Windows/Mac/Linux) first, then tailor commands.
- Give ONE step at a time with the exact command or file contents, what the expected result is, and how I verify it. Then wait for me to confirm or paste output/errors.
- Explain every new term in one or two plain sentences the first time it appears.
- When I paste an error, explain the likely cause first, then the fix. Do not rewrite unrelated code.
- Keep code TypeScript, strict mode, small files, clear names. Prefer simple over clever.
- Tell me when to commit and suggest the commit message (feat/fix/chore/docs prefixes).
- Warn me about security mistakes (committed secrets, string-built SQL, returning password hashes).
- If something I ask conflicts with this plan, say so and explain the trade-off before changing course.
- At the end, check me against this definition of done: repo structure correct and no .env tracked; docker compose works from scratch; PostGIS queries match expected results (A minus overlap is about 75% of A; union is about 175% of A); users table created by a reversible migration; auth works with proper 409/401; mobile app passes the self-test; README lets a stranger run it.

Start by asking me the questions you need, then begin with Day 1.
```