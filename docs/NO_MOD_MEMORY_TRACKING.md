# No-Mod Memory Tracking Notes

A browser cannot directly read another Windows process. The companion app must run locally and read Subnautica 2 from outside the game.

## Realistic no-mod approaches

### 1. Read-only process memory scanning

Best for live player position.

You identify where the game stores the local player's world position, then the companion app reads those float values every 50-250 ms.

Pros:
- Real-time.
- Does not modify game files.
- Does not require a mod loader.

Cons:
- Offsets can break after patches.
- You need to discover the pointer chain.
- Scan/interact events are harder than coordinates.

### 2. Screen/OCR scraping

Useful only if the game visibly shows coordinates or scan text on screen.

Pros:
- Does not touch game memory.
- Less likely to break process access rules.

Cons:
- Less accurate.
- Slower.
- UI changes break it.
- Detecting scan events is unreliable.

### 3. Save-file or log-file watching

Useful for task/progression tracking, not real-time location.

Pros:
- Safer and simpler.

Cons:
- Not real-time.
- May not expose location or scan events.

## Recommended MVP

Start with read-only memory tracking for:

```json
{
  "x": 123.4,
  "y": -50.2,
  "z": 991.0,
  "yaw": 180.0
}
```

Then send that to the web map through:

```text
ws://127.0.0.1:8787/ws
```

## Discovering the coordinate addresses

High-level workflow:

1. Launch Subnautica 2 and load into a save.
2. Find a way to see your current coordinates in the game.
3. Use a read-only memory scanner to search for the X coordinate as a 32-bit float.
4. Move in-game so only that coordinate changes clearly.
5. Filter scan results by the new value.
6. Repeat until you find a likely X address.
7. Find nearby Y/Z floats, or repeat for each axis.
8. Restart the game and see whether the address changes.
9. If it changes, find the pointer chain from the module base address.
10. Put the module/base offset/pointer offsets into `appsettings.json`.

## What goes into appsettings.json

Temporary absolute address mode:

```json
"AddressMode": "absolute",
"AbsoluteXAddressHex": "0x0000000000000000",
"AbsoluteYAddressHex": "0x0000000000000000",
"AbsoluteZAddressHex": "0x0000000000000000",
"AbsoluteYawAddressHex": "0x0000000000000000"
```

More stable pointer-chain mode:

```json
"AddressMode": "pointer-chain",
"BaseOffsetHex": "0x00000000",
"PointerOffsetsHex": ["0x10", "0x28", "0x80"],
"XOffsetHex": "0x0",
"YOffsetHex": "0x4",
"ZOffsetHex": "0x8",
"YawOffsetHex": "0xC"
```

The example offsets above are placeholders.

## Scan/interact tracking later

For things like "player scanned a fish," you likely need one of these:

- Read scanner/progression state from memory.
- Watch save/progression data for newly unlocked entries.
- OCR the scanning UI and infer state.
- Use an official/plugin/mod API if one becomes available.

For a no-mod product, task/progression tracking should come after location tracking.
