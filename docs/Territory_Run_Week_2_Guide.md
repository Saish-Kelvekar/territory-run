# Territory Run: Week 2 Guide (Oct 12 - Oct 18)

**Goal of the week:** a development build of the app running on your phone, location permission handled properly, and a Run screen with a MapLibre map showing your live GPS position and your path, with distance and a timer.

**Time:** about 15 hours (weekdays 2 h, weekend 4 to 5 h). **Rule:** if stuck for more than 1 hour, copy the exact error and the command you ran and ask your mentor.

**In scope:** dev build, permissions, map, live location, live path, local distance and timer.

**Not in scope:** sending anything to the backend, a `runs` table, saving runs, loop detection, background or screen-off tracking (Week 4), GPX simulation (Week 3), TanStack Query, Zustand.

## What the docs confirmed

- `@maplibre/maplibre-react-native` cannot run in Expo Go because it is not part of the Expo SDK. The development build is a requirement, not a choice.
- Install it with `npx expo install @maplibre/maplibre-react-native` and add it to the `plugins` array of `app.json` (or `app.config.{js,ts}`), then rebuild the app.
- MapLibre itself needs no API key. The map needs a **style URL** that describes where the tiles come from. OpenFreeMap offers public MapLibre-compatible styles without a key, for example `https://tiles.openfreemap.org/styles/liberty`. Its terms say the service is provided as-is and may change or be discontinued. That is fine for a portfolio project. Keep the style URL in one config constant so it can be swapped later.
- OpenStreetMap's own standard tile server serves raster images under a separate usage policy. Do not point the app at it.
- Component and prop names differ between MapLibre React Native versions. Always tell the coding agent to read the docs for the **installed** version instead of relying on memory.

## Concepts to know first

- **Development build:** your own version of the app with native code (maps, location) compiled in. It still hot-reloads like Expo Go.
- **EAS Build:** Expo's cloud service that compiles the Android build, so Android Studio is not needed. It has a queue and free-tier limits; check the current limits in the Expo docs.
- **Style URL and tiles:** MapLibre draws the map from a style (a JSON file) that points to map data.
- **GeoJSON:** a standard JSON format for points and lines. The path is drawn by giving the map a GeoJSON `LineString` and a line layer. PostGIS can output the same format later.
- **GPS accuracy:** each reading includes `accuracy`, the error radius in meters. The project rule drops points worse than 30 m.
- **`watchPositionAsync`:** `expo-location`'s call that fires whenever the position changes while the app is open. Screen-off tracking (foreground service plus `expo-task-manager`) is Week 4.

## Day 1 (2 h): Setup decisions and a new branch

1. `git checkout main && git pull`, then `git checkout -b week-2-location`.
2. Decide the **style URL** (OpenFreeMap "liberty" is the default candidate). Open it in a browser first to confirm it returns JSON.
3. Create an Expo account at expo.dev if you do not have one.
4. Pick a permanent **Android package name** for `app.json`, such as `com.<yourname>.territoryrun`. Changing it after publishing is painful.
5. Make sure `mobile/.env` stays ignored, and add any new variable names to `mobile/.env.example`.

**Done when:** you are on the new branch, you have an Expo account, and you have chosen the package name and style URL.

## Day 2 (2 h): EAS and the first development build

Do this early; the cloud build can wait in a queue.

1. In `mobile/`: `npx expo install expo-dev-client`, install the EAS CLI (`npm i -g eas-cli`), then `eas login`.
2. Set `android.package` in `app.json`.
3. Install `@maplibre/maplibre-react-native` and `expo-location` with `npx expo install`, and add the MapLibre plugin to `app.json`. Do this **before** starting the build so the first build already contains the native map code.
4. Run `eas build:configure`, then `eas build --profile development --platform android`. Check the current Expo docs for your SDK, because flags and config names change.
5. When the build finishes, install the APK on your phone using the link or QR code.

**Done when:** the APK is installed and `npx expo start --dev-client` connects.

**Commit:** `chore(mobile): add eas dev build and maplibre plugin`

## Day 3 (2 h): Verify auth, then location permission

1. Open the dev build, connect to Metro, and confirm the Week 1 auth flow still works. `EXPO_PUBLIC_API_URL` should work as before.
2. Add the `expo-location` plugin config to `app.json` as its docs say.
3. Build a `useLocationPermission` hook that checks the status, requests **foreground** permission, and returns `unknown | granted | denied | blocked`.
4. Build the **Permission-needed screen**: it explains why the app needs location, has a "Grant permission" button, and an "Open settings" button when the permission is permanently blocked.

**Done when:** a first-time user sees the system prompt, and denying it leads to a screen with a working path to settings.

Remember: changing native config (plugins, permissions) means a **new dev build**.

**Commit:** `feat(mobile): location permission hook and screen`

## Day 4 (2 h): The map on the Run tab

1. Create the Run screen with a full-screen MapLibre map using the style URL from your config constant.
2. Get your current position once with `getCurrentPositionAsync` and center the camera on it. Show your position as a marker.
3. Handle the states: loading while waiting for the first fix, an error if location services are off, and a visible error if the map style fails to load.
4. Show the required **attribution** (OpenStreetMap and OpenFreeMap credits) if the style does not display it automatically.

**Done when:** the map renders with real tiles and your location. If the map is blank, open the style URL in your phone's browser to test it.

**Commit:** `feat(mobile): maplibre run screen with current position`

## Day 5 (2.5 h): Live location tracking

1. Create a `useLiveLocation` hook around `watchPositionAsync`, with high accuracy and a distance interval of a few meters. Return the latest point and its accuracy.
2. Store points as `{ latitude, longitude, accuracy, timestamp }`. Remove the subscription when the screen unmounts, or the watcher leaks.
3. Show the accuracy on screen for now. It will be used to tune thresholds.
4. Apply the rule: **keep every reading in a raw list, and add only readings with accuracy 30 m or better to the "accepted" path.**

**Done when:** walking around updates the latest position and the accepted-point count rises.

**Commit:** `feat(mobile): live location hook with accuracy filter`

## Day 6 (2.5 h): Live path, distance and timer

1. Convert the accepted points to a GeoJSON `LineString` and draw it with a line layer. GeoJSON uses `[longitude, latitude]` order, which is a very common source of bugs.
2. Add Start, Pause and Finish buttons backed by a small run-state hook (idle, running, paused, finished) using `useReducer` or `useState`.
3. Write a `haversine` function in `src/utils/geo.ts` (distance in meters between two lat/lng points) and a **unit test** with two known points.
4. Show total distance and elapsed time. The timer must exclude paused time.
5. Add a "loop closed?" indicator that turns on when the current position is within 40 m of the start. No server logic.

**Done when:** you press Start, walk, and the line follows you with distance and time updating. Pause stops both.

**Commit:** `feat(mobile): live path, run state, distance and timer`

## Day 7 (4 h): Outdoor test and wrap-up

1. **Walk a real loop outside** (a block or park). Record: how many raw points were dropped for accuracy, typical accuracy, whether the line is smooth or jumpy, and your phone's distance compared with the real distance.
2. Write the observations in `docs/field-notes.md`. They are real data for tuning the 30 m and 40 m thresholds later.
3. Fix the top two or three bugs you found.
4. Update the README: how to build and install the dev client, how to run `npx expo start --dev-client`, and the map style setup.
5. Final commit, pull request, merge, then:

```
git checkout main
git pull
git tag week-2-done
git push --tags
```

## Commit habits

Small commits (`feat(mobile): ...`, `fix(mobile): ...`, `chore: ...`, `docs: ...`), work on `week-2-location`, open a PR, never commit `.env`.

## Week 2 definition of done

- [ ] A development build is installed on the phone and `expo start --dev-client` connects
- [ ] Auth still works inside the dev build
- [ ] The permission prompt, denied state and blocked-to-settings flow all work
- [ ] The MapLibre map shows real tiles and your location, with attribution visible
- [ ] The live path follows you, with distance, timer, and Start/Pause/Finish
- [ ] Points worse than 30 m accuracy are excluded from the path but kept in the raw list
- [ ] `haversine` has at least one passing unit test
- [ ] An outdoor walk was done, with notes in `docs/field-notes.md`
- [ ] README updated, PR merged, `week-2-done` tagged

## Common problems

- **Map is blank or white:** the style URL is wrong or unreachable from the phone, or the app was not rebuilt after adding the plugin. Open the style URL in the phone's browser to test.
- **App crashes when opening the Run screen in the dev build:** the native MapLibre code is not in your build. Rebuild after adding the plugin.
- **Line appears in the wrong place (ocean or another continent):** latitude and longitude are swapped. GeoJSON wants `[lng, lat]`.
- **Permission prompt never appears:** native config changed without a new dev build, or the permission was denied earlier. Clear the app's permissions in Android settings.
- **Position jumps 50+ m indoors:** normal. Test outdoors with a clear sky.
- **EAS build fails:** read the **first** error in the build log, not the last.
- **Watcher still running after leaving the screen:** the subscription was not removed in the effect cleanup.

## Using the coding agent this week

Paste each prompt to your mentor for review before sending it to the agent. Keep prompts small. A good split:

1. EAS config and package installs
2. The permission hook and screen
3. The map screen
4. The live location hook
5. The path layer, run state and `haversine` with its test

Every prompt should say "no backend calls, no saving, no background tracking" and should tell the agent to **check the current docs for the installed MapLibre and expo-location versions** instead of guessing. Never let the agent read or edit `.env` files.
