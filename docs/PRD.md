# Territory Run: PRD and Build Guide

Assumptions: Android-first (iOS-compatible code), about 15 hrs/week, 21 weeks from Oct 5 to Feb 28, PostgreSQL + PostGIS, raw SQL to learn it properly. Change anything that doesn't fit.

## 1. Product

**One line:** A running app where a closed-loop run claims the enclosed area as your territory; other runners can take it by enclosing it in their own loops. Map resets weekly.

**Goals:** Real auth + CRUD + maps + GPS tracking + geospatial SQL, shipped as an Android build, in a form that works as an intern portfolio piece.

**Non-goals (v1):** Live multiplayer, social feed, payments, iOS release, offline sync, route sharing.

## 2. Rules (the source of truth)

1. **Run:** user records GPS points. Points with accuracy worse than 30 m are dropped.
2. **Loop:** a run is a loop if the end point is within 40 m of the start point. Loop polygon = closed path, made valid (figure-eights are split into valid pieces).
3. **Minimums (configurable):** loop area at least 2,000 m², run distance at least 300 m.
4. **Claim:** everything inside the loop becomes yours.
5. **Conquest:** any part of another player's territory inside your loop is cut from theirs and added to yours. Land outside your loop is untouched.
6. **Fragments:** territory can be split into many pieces (MultiPolygon). Pieces under 10 m² are deleted.
7. **Anti-cheat:** reject if average speed is above 7 m/s (\~25 km/h), if any point-to-point jump implies above 12 m/s, or if timestamps are not increasing. Store the rejection reason.
8. **Week:** runs and territories belong to a week. Reset is Monday 00:00 Asia/Kolkata. Reset = create a new week row. Old data is kept for history.
9. **Leaderboards (current week):** (a) total territory area, (b) total distance run.

## 3. Tech stack

**Mobile**

- Expo (latest SDK), Expo Router, TypeScript, EAS development + preview + production builds
- `expo-location` + `expo-task-manager` (foreground service tracking), `expo-secure-store`
- `react-native-maps` (needs a Google Maps API key on Android; free tier for native maps, check current terms). Alternative: MapLibre (no key, more setup)
- TanStack Query (server state), Zustand (UI/run state), React Hook Form + Zod (forms)
- Jest + React Native Testing Library

**Backend**

- Node.js + Express + TypeScript
- `pg` (node-postgres) with **raw SQL**, no ORM, because learning SQL is the goal
- `node-pg-migrate` for migrations
- `zod` validation, `jsonwebtoken`, `bcrypt`, `helmet`, `express-rate-limit`, `pino` logs, `node-cron`
- Vitest/Jest + Supertest

**Database**

- PostgreSQL 16 + **PostGIS** (Docker image `postgis/postgis:16-3.4` locally)
- Hosted: Neon or Supabase (both support PostGIS; check current free-tier limits)

**Deploy:** backend on Render or Railway, DB on Neon/Supabase, mobile via EAS (APK for preview, AAB for production).

**Tooling:** GitHub from day one, Postman/Bruno, DBeaver or pgAdmin, GPX files for route simulation.

*Change from earlier advice:* with Postgres, PostGIS replaces my earlier "Turf.js + JSON" idea. The database does the geometry (ST_Difference, ST_Union, ST_Area), which is better SQL practice and a stronger resume line. Turf stays optional on the client for drawing helpers.

## 4. Architecture

```
Expo app (screens -> hooks -> services)
        | HTTPS + JWT
Express (routes -> controllers -> services -> SQL)
        |
PostgreSQL + PostGIS
node-cron: weekly rollover (idempotent)
```

**Repo layout (monorepo):**

```
territory-run/
  mobile/   app/ (routes only)  src/{components,hooks,services,store,types,utils}
  server/   src/{routes,controllers,services,db,middleware,jobs,config}  migrations/
  docs/     PRD.md  rules.md
  docker-compose.yml
```

## 5. Data model

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  color text NOT NULL,               -- map colour
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE weeks (
  id serial PRIMARY KEY,
  starts_at timestamptz NOT NULL UNIQUE,
  ends_at timestamptz NOT NULL
);

CREATE TABLE runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  week_id int NOT NULL REFERENCES weeks(id),
  path geography(LineString, 4326) NOT NULL,
  distance_m numeric NOT NULL,
  duration_s int NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('accepted','rejected')),
  reject_reason text,
  is_loop boolean NOT NULL DEFAULT false,
  loop_area_m2 numeric
);
CREATE INDEX runs_user_week_idx ON runs (user_id, week_id);
CREATE INDEX runs_path_gix ON runs USING gist (path);

CREATE TABLE territories (
  user_id uuid NOT NULL REFERENCES users(id),
  week_id int NOT NULL REFERENCES weeks(id),
  geom geometry(MultiPolygon, 4326) NOT NULL,
  area_m2 numeric NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, week_id)
);
CREATE INDEX territories_geom_gix ON territories USING gist (geom);

CREATE TABLE weekly_results (        -- written at rollover
  week_id int NOT NULL REFERENCES weeks(id),
  user_id uuid NOT NULL REFERENCES users(id),
  area_m2 numeric, distance_m numeric,
  area_rank int, distance_rank int,
  PRIMARY KEY (week_id, user_id)
);
```

## 6. Key SQL (the heart of the project)

**Capture (one transaction per accepted loop run):**

```sql
BEGIN;
SELECT pg_advisory_xact_lock($week_id);          -- serialise captures per week

-- loop polygon from the run path
WITH loop AS (
  SELECT ST_MakeValid(ST_MakePolygon(ST_AddPoint(l, ST_StartPoint(l)))) AS g
  FROM (SELECT $path_geometry::geometry AS l) s
)
-- 1) cut it out of everyone else
UPDATE territories t
SET geom = ST_Multi(ST_CollectionExtract(ST_Difference(t.geom, loop.g), 3)),
    updated_at = now()
FROM loop
WHERE t.week_id = $week_id AND t.user_id <> $user_id
  AND ST_Intersects(t.geom, loop.g);

-- 2) add it to mine (upsert + ST_Union)
-- 3) recompute area_m2 = ST_Area(geom::geography)
-- 4) delete pieces under 10 m², delete empty territories
COMMIT;
```

Tune with `ST_Snap`/`ST_ReducePrecision` if you hit topology errors.

**Leaderboards:**

```sql
-- area
SELECT u.username, t.area_m2, RANK() OVER (ORDER BY t.area_m2 DESC) AS rank
FROM territories t JOIN users u ON u.id = t.user_id
WHERE t.week_id = $1 ORDER BY rank LIMIT 50;

-- distance
SELECT u.username, SUM(r.distance_m) AS total,
       RANK() OVER (ORDER BY SUM(r.distance_m) DESC) AS rank
FROM runs r JOIN users u ON u.id = r.user_id
WHERE r.week_id = $1 AND r.status = 'accepted'
GROUP BY u.username ORDER BY rank LIMIT 50;
```

**Map viewport:** `WHERE ST_Intersects(geom, ST_MakeEnvelope($w,$s,$e,$n,4326))` and `ST_AsGeoJSON(ST_Simplify(geom, 0.00002))`.

## 7. API

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | /auth/register, /auth/login | no | Register / login |
| GET | /auth/me | yes | Current user |
| POST | /runs | yes | Submit finished run (points + timestamps); validates, saves, captures |
| GET | /runs, /runs/:id | yes | History / detail |
| GET | /territories?bbox=w,s,e,n | yes | Current-week territories as GeoJSON |
| GET | /leaderboards/area, /leaderboards/distance | yes | Current week; optional `?weekId=` |
| GET | /weeks/current | yes | Week + countdown |
| GET | /users/me/stats | yes | Area, distance, rank |

Error shape everywhere: `{ message, code, fields? }`.

## 8. Screens

Auth: Login, Register. Tabs: **Map** (all territories, my colour, locate me), **Run** (start/pause/finish, live path, distance, timer, loop indicator), **Leaderboard** (Area / Distance toggle, week countdown), **Profile** (stats, run history, logout). Stack: Run detail (path + captured area), Permission-needed screen.

States for each: loading, empty, error, no network, location permission denied.

## 9. Postgres learning checklist (tied to features)

- [ ] Joins, GROUP BY, aggregates (leaderboards)
- [ ] Constraints, foreign keys, CHECK, UNIQUE (schema above)
- [ ] Indexes, GiST vs B-tree, `EXPLAIN ANALYZE` (viewport query)
- [ ] Window functions: RANK, ROW_NUMBER (leaderboards)
- [ ] Transactions, isolation, advisory locks (capture)
- [ ] CTEs and UPSERT with `ON CONFLICT` (capture, rollover)
- [ ] PostGIS: geometry vs geography, SRID 4326, ST_Area, ST_Union, ST_Difference, ST_Intersects
- [ ] Migrations and seed data (`node-pg-migrate`)

## 10. Timeline (about 15 hrs/week)

| Wk | Starts | Focus |
| --- | --- | --- |
| 1 | Oct 5 | Docker Postgres+PostGIS, SQL practice, monorepo, move your Week 4 auth backend to Postgres (users table, migrations) |
| 2 | Oct 12 | EAS development build, location permissions, foreground tracking, live path on map |
| 3 | Oct 19 | **Spike:** send points to backend, build polygon in PostGIS, draw it. GPX simulation mode |
| 4 | Oct 26 | `runs` table, POST /runs, run screen (start/pause/finish), foreground service |
| 5 | Nov 2 | Run history/detail, anti-cheat validation |
| 6 | Nov 9 | Loop detection + capture transaction |
| 7 | Nov 16 | Territory map screen, viewport query, polygon rendering |
| 8 | Nov 23 | Geometry test suite (overlap, split, swallow, figure-eight), concurrency test |
| 9 | Nov 30 | Leaderboards, profile stats |
| 10 | Dec 7 | Weekly rollover job, weekly history, countdown |
| 11 | Dec 14 | Preview APK, **real outdoor test runs**, fix GPS issues |
| 12 | Dec 21 | Forms/state cleanup, error/offline/permission states |
| 13 | Dec 28 | Buffer, or stretch: "your land was taken" push notification |
| 14 | Jan 4 | Buffer + **feature freeze (Jan 10)** |
| 15 | Jan 11 | Tests, security pass, performance, dependency audit |
| 16 | Jan 18 | Deploy backend + DB, production AAB, README, demo video. **Start applying** |
| 17-21 | Jan 25 - Feb 28 | Apply, interview prep, resume bullets, bug fixes, iOS-compat check (no new features) |

If you fall behind, cut in this order: push notifications, weekly history screen, run detail polish. Never cut tests, the preview APK, or the README.

## 11. Start coding today

1. `git init territory-run`, create GitHub repo, add `.gitignore` (env files, `node_modules`).
2. `docker-compose.yml` with `postgis/postgis:16-3.4`, port 5432, a volume, and env vars.
3. In `server/`: add `pg` and `node-pg-migrate`; first migration enables PostGIS and creates `users`.
4. Port register/login/me from your Week 4 backend to Postgres queries.
5. Run `SELECT PostGIS_Version();` and `SELECT ST_Area(ST_GeogFromText('POLYGON((...))'));` to confirm it works.
6. In `mobile/`: point your Week 4 app at the new backend, then start Week 2's development build.

## 12. Open decisions (change later, not now)

- Exact thresholds (30 m accuracy, 40 m closure, 2,000 m² minimum) are starting values. Tune after field tests.
- Map library: start with react-native-maps; switch only if the Google key is a problem.
- Territory decay, teams, and run replays are v2 ideas.