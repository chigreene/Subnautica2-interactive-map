# Subnautica 2 Companion App MVP

This is a no-mod companion-app starter for a web-based Subnautica 2 map.

The app runs on Windows, hosts a local web map at `http://127.0.0.1:8787`, and streams live player data over WebSocket at `ws://127.0.0.1:8787/ws`.

## What works immediately

- A local browser map with a moving player marker.
- A local WebSocket feed.
- Manual coordinate posting for testing.
- A read-only process-memory reader skeleton for the real no-mod implementation.

## What still needs game-specific work

The app cannot know Subnautica 2's player-location memory addresses automatically. To make real no-mod tracking work, you must identify the memory address or pointer chain for the player's world coordinates, then put those offsets in `appsettings.json`.

That is normal for a no-mod companion app. Without a mod/plugin/API, the game does not voluntarily publish location data.

## Install prerequisites

Install the .NET 8 SDK:

https://dotnet.microsoft.com/download

Then open PowerShell in this folder:

```powershell
cd companion-app
```

## Run the simulator first

```powershell
dotnet run
```

Open:

```text
http://127.0.0.1:8787
```

You should see a marker moving around the map.

## Test manual position updates

In another PowerShell window from the project root:

```powershell
./tools/send-test-position.ps1
```

The marker should jump.

## Switch to real memory mode later

Edit:

```text
companion-app/appsettings.json
```

Change:

```json
"Mode": "simulator"
```

To:

```json
"Mode": "memory"
```

Then fill in the discovered memory offsets in the `Memory` section.

## Current architecture

```text
Subnautica2.exe
  ↓ read-only Windows process memory read
SN2Companion.exe
  ↓ ws://127.0.0.1:8787/ws
Browser map
  ↓ marker/task UI updates
Web app
```

## Important safety/legal note

This starter is read-only. Do not add memory writing, injection, anti-cheat bypassing, or multiplayer advantage features. Before distributing this publicly, review the game's EULA/ToS and make sure users understand what the app reads locally.
