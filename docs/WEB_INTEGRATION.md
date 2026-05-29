# Website Integration

The local companion app exposes this WebSocket:

```text
ws://127.0.0.1:8787/ws
```

A website can connect from JavaScript:

```js
const socket = new WebSocket('ws://127.0.0.1:8787/ws');

socket.onmessage = (event) => {
  const state = JSON.parse(event.data);
  updatePlayerMarker(state.x, state.y, state.z, state.yaw);
};
```

Example message:

```json
{
  "x": 100.5,
  "y": -34.2,
  "z": 991.0,
  "yaw": 180.0,
  "source": "memory",
  "updatedAtUnixMs": 1779460000000,
  "events": []
}
```

## For a hosted website

If your actual map is hosted online, it can still connect to a local companion app, but you may need to handle browser mixed-content rules.

Common approaches:

1. Serve the website locally from the companion app during the MVP.
2. Use `ws://127.0.0.1` from an `http://` site.
3. For a production `https://` website, use a secure local WebSocket setup or a native app protocol/deep-link flow.

MVP recommendation: serve the map locally first.
