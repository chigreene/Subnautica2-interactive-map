const canvas = document.getElementById('map');
const ctx = canvas.getContext('2d');
const mapImage = new Image();
mapImage.src = 'maps/sn2-sector-map.png';

const fields = {
  connection: document.getElementById('connection'),
  source: document.getElementById('source'),
  x: document.getElementById('x'),
  y: document.getElementById('y'),
  z: document.getElementById('z'),
  yaw: document.getElementById('yaw'),
  scale: document.getElementById('scale'),
  coordDivisor: document.getElementById('coordDivisor'),
  originX: document.getElementById('originX'),
  originY: document.getElementById('originY'),
  axisX: document.getElementById('axisX'),
  axisY: document.getElementById('axisY'),
  cursor: document.getElementById('cursor'),
  feedWarning: document.getElementById('feedWarning'),
};

let latest = { x: 0, y: 0, z: 0, yaw: 0, source: 'initial' };
let cursorMapPoint = null;

function axisValue(axis, state) {
  switch (axis) {
    case 'x': return state.x;
    case '-x': return -state.x;
    case 'z': return state.z;
    case '-z': return -state.z;
    default: return state.x;
  }
}

function axisName(axis) {
  return axis.startsWith('-') ? axis.slice(1) : axis;
}

function axisSign(axis) {
  return axis.startsWith('-') ? -1 : 1;
}

function mapScale() {
  const scale = Number(fields.scale.value);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function coordDivisor() {
  const divisor = Number(fields.coordDivisor?.value);
  return Number.isFinite(divisor) && divisor > 0 ? divisor : 1;
}

function mapState(state) {
  const divisor = coordDivisor();
  return {
    ...state,
    x: Number(state.x ?? 0) / divisor,
    z: Number(state.z ?? 0) / divisor,
  };
}

function worldToMap(state) {
  const scale = mapScale();
  const mapped = mapState(state);
  const originX = Number(fields.originX.value || canvas.width / 2);
  const originY = Number(fields.originY.value || canvas.height / 2);
  return {
    x: originX + axisValue(fields.axisX.value, mapped) * scale,
    y: originY + axisValue(fields.axisY.value, mapped) * scale,
  };
}

function mapToWorld(point) {
  const scale = mapScale();
  const divisor = coordDivisor();
  const originX = Number(fields.originX.value || canvas.width / 2);
  const originY = Number(fields.originY.value || canvas.height / 2);
  const world = { x: 0, y: Number(latest.y ?? 0), z: 0 };

  world[axisName(fields.axisX.value)] = ((point.x - originX) / scale) * axisSign(fields.axisX.value) * divisor;
  world[axisName(fields.axisY.value)] = ((point.y - originY) / scale) * axisSign(fields.axisY.value) * divisor;

  return world;
}

function drawMapBase() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (mapImage.complete && mapImage.naturalWidth) {
    ctx.drawImage(mapImage, 0, 0, canvas.width, canvas.height);
  } else {
    ctx.fillStyle = '#061015';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function drawGrid() {
  const scale = mapScale();
  const originX = Number(fields.originX.value || canvas.width / 2);
  const originY = Number(fields.originY.value || canvas.height / 2);
  const stepMeters = 250;
  const stepPixels = stepMeters * scale;

  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 1;
  for (let x = originX % stepPixels; x <= canvas.width; x += stepPixels) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = originY % stepPixels; y <= canvas.height; y += stepPixels) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(105, 255, 214, 0.75)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(originX, originY, 9, 0, Math.PI * 2);
  ctx.moveTo(originX - 18, originY);
  ctx.lineTo(originX + 18, originY);
  ctx.moveTo(originX, originY - 18);
  ctx.lineTo(originX, originY + 18);
  ctx.stroke();

  ctx.fillStyle = 'rgba(5, 12, 16, 0.78)';
  ctx.fillRect(originX + 12, originY - 31, 66, 22);
  ctx.fillStyle = '#d9fff7';
  ctx.font = '700 14px system-ui';
  ctx.fillText('0, 0, 0', originX + 14, originY - 14);
  ctx.font = '12px system-ui';
  ctx.fillText(`${stepMeters}m grid`, originX + 14, originY + 20);
}

function drawPlayer(state) {
  const p = worldToMap(state);
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return;

  const yawRadians = (state.yaw - 90) * Math.PI / 180;
  const x = Number(state.x ?? 0);
  const y = Number(state.y ?? 0);
  const z = Number(state.z ?? 0);

  ctx.save();
  ctx.translate(p.x, p.y);

  ctx.strokeStyle = 'rgba(255, 224, 112, 0.95)';
  ctx.fillStyle = 'rgba(4, 10, 14, 0.78)';
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  ctx.moveTo(-28, 0);
  ctx.lineTo(28, 0);
  ctx.moveTo(0, -28);
  ctx.lineTo(0, 28);
  ctx.stroke();

  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.beginPath();
  ctx.moveTo(-10, 0);
  ctx.lineTo(10, 0);
  ctx.moveTo(0, -10);
  ctx.lineTo(0, 10);
  ctx.stroke();

  ctx.restore();

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(yawRadians);

  ctx.fillStyle = '#aaf2ff';
  ctx.strokeStyle = '#012c3c';
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-12, -10);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-12, 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();

  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '14px system-ui';
  ctx.fillText(`X ${x.toFixed(1)} / Z ${z.toFixed(1)}`, p.x + 34, p.y - 18);
  ctx.fillText(`depth ${y.toFixed(1)}m`, p.x + 34, p.y + 1);
}

function drawCursor() {
  if (!cursorMapPoint) return;

  ctx.strokeStyle = 'rgba(255, 224, 112, 0.9)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cursorMapPoint.x - 10, cursorMapPoint.y);
  ctx.lineTo(cursorMapPoint.x + 10, cursorMapPoint.y);
  ctx.moveTo(cursorMapPoint.x, cursorMapPoint.y - 10);
  ctx.lineTo(cursorMapPoint.x, cursorMapPoint.y + 10);
  ctx.stroke();
}

function render() {
  drawMapBase();
  drawGrid();
  drawPlayer(latest);
  drawCursor();
  requestAnimationFrame(render);
}

function updateText(state) {
  fields.source.textContent = state.source ?? 'unknown';
  fields.x.textContent = Number(state.x ?? 0).toFixed(2);
  fields.y.textContent = Number(state.y ?? 0).toFixed(2);
  fields.z.textContent = Number(state.z ?? 0).toFixed(2);
  fields.yaw.textContent = Number(state.yaw ?? 0).toFixed(1);

  const p = worldToMap(state);
  const mapped = mapState(state);
  const tooLarge = Math.abs(mapped.x) > 10000 || Math.abs(mapped.z) > 10000;
  const offMap = p.x < -100 || p.x > canvas.width + 100 || p.y < -100 || p.y > canvas.height + 100;
  const badSource = String(state.source ?? '').includes('error') || String(state.source ?? '').includes('not-found');

  if (badSource || tooLarge || offMap) {
    fields.feedWarning.hidden = false;
    fields.feedWarning.textContent = badSource
      ? `Feed problem: ${state.source}`
      : 'Feed values look wrong for the current map calibration. Check /debug-memory and update appsettings.json.';
  } else {
    fields.feedWarning.hidden = true;
    fields.feedWarning.textContent = '';
  }
}

function updateCursorText(event) {
  const rect = canvas.getBoundingClientRect();
  cursorMapPoint = {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };

  const world = mapToWorld(cursorMapPoint);
  fields.cursor.textContent = `map ${cursorMapPoint.x.toFixed(0)}, ${cursorMapPoint.y.toFixed(0)} | world X ${world.x.toFixed(0)}, Z ${world.z.toFixed(0)}`;
}

canvas.addEventListener('mousemove', updateCursorText);
canvas.addEventListener('mouseleave', () => {
  cursorMapPoint = null;
  fields.cursor.textContent = 'Hover the map';
});

function connect() {
  const host = location.host || '127.0.0.1:8787';
  const ws = new WebSocket(`ws://${host}/ws`);

  ws.onopen = () => {
    fields.connection.textContent = 'Connected';
  };

  ws.onmessage = (event) => {
    latest = JSON.parse(event.data);
    updateText(latest);
  };

  ws.onclose = () => {
    fields.connection.textContent = 'Disconnected; retrying';
    setTimeout(connect, 1000);
  };

  ws.onerror = () => {
    fields.connection.textContent = 'Connection error';
    ws.close();
  };
}

connect();
render();
