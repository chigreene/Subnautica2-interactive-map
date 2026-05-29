const canvas = document.getElementById('map');
const ctx = canvas.getContext('2d');
const mapImage = new Image();
mapImage.src = 'maps/sn2-sector-map.png';
const CALIBRATION_STORAGE_KEY = 'sn2-affine-calibration-v1';
const TARGET_CALIBRATION_POINTS = 10;

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
  calibrationMode: document.getElementById('calibrationMode'),
  calPointCount: document.getElementById('calPointCount'),
  calRms: document.getElementById('calRms'),
  calPointList: document.getElementById('calPointList'),
  undoCalPoint: document.getElementById('undoCalPoint'),
  clearCalPoints: document.getElementById('clearCalPoints'),
};

let latest = { x: 0, y: 0, z: 0, yaw: 0, source: 'initial' };
let cursorMapPoint = null;
let calibrationPoints = loadCalibrationPoints();
let affineFit = null;

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

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function mapState(state) {
  const divisor = coordDivisor();
  return {
    ...state,
    x: finiteNumber(state.x) / divisor,
    z: finiteNumber(state.z) / divisor,
  };
}

function loadCalibrationPoints() {
  try {
    const stored = JSON.parse(localStorage.getItem(CALIBRATION_STORAGE_KEY) || '[]');
    if (!Array.isArray(stored)) return [];

    return stored
      .map((point) => ({
        id: String(point.id || `${Date.now()}-${Math.random()}`),
        gameX: Number(point.gameX),
        gameZ: Number(point.gameZ),
        mapX: Number(point.mapX),
        mapY: Number(point.mapY),
      }))
      .filter((point) => (
        Number.isFinite(point.gameX) &&
        Number.isFinite(point.gameZ) &&
        Number.isFinite(point.mapX) &&
        Number.isFinite(point.mapY)
      ));
  } catch {
    return [];
  }
}

function saveCalibrationPoints() {
  localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(calibrationPoints));
}

function solve3x3(matrix, vector) {
  const rows = matrix.map((row, index) => [...row, vector[index]]);

  for (let pivot = 0; pivot < 3; pivot += 1) {
    let bestRow = pivot;
    for (let row = pivot + 1; row < 3; row += 1) {
      if (Math.abs(rows[row][pivot]) > Math.abs(rows[bestRow][pivot])) {
        bestRow = row;
      }
    }

    if (Math.abs(rows[bestRow][pivot]) < 1e-9) {
      return null;
    }

    if (bestRow !== pivot) {
      [rows[pivot], rows[bestRow]] = [rows[bestRow], rows[pivot]];
    }

    const divisor = rows[pivot][pivot];
    for (let col = pivot; col < 4; col += 1) {
      rows[pivot][col] /= divisor;
    }

    for (let row = 0; row < 3; row += 1) {
      if (row === pivot) continue;
      const factor = rows[row][pivot];
      for (let col = pivot; col < 4; col += 1) {
        rows[row][col] -= factor * rows[pivot][col];
      }
    }
  }

  return [rows[0][3], rows[1][3], rows[2][3]];
}

function projectWithTransform(transform, gameX, gameZ) {
  const dx = gameX - transform.meanX;
  const dz = gameZ - transform.meanZ;
  return {
    x: transform.x[0] * dx + transform.x[1] * dz + transform.x[2],
    y: transform.y[0] * dx + transform.y[1] * dz + transform.y[2],
  };
}

function solveAffine(points) {
  if (points.length < 3) return null;

  const meanX = points.reduce((sum, point) => sum + point.gameX, 0) / points.length;
  const meanZ = points.reduce((sum, point) => sum + point.gameZ, 0) / points.length;
  let xx = 0;
  let xz = 0;
  let zz = 0;
  let x = 0;
  let z = 0;
  let px = 0;
  let py = 0;
  let xpx = 0;
  let zpx = 0;
  let xpy = 0;
  let zpy = 0;

  for (const point of points) {
    const dx = point.gameX - meanX;
    const dz = point.gameZ - meanZ;
    xx += dx * dx;
    xz += dx * dz;
    zz += dz * dz;
    x += dx;
    z += dz;
    px += point.mapX;
    py += point.mapY;
    xpx += dx * point.mapX;
    zpx += dz * point.mapX;
    xpy += dx * point.mapY;
    zpy += dz * point.mapY;
  }

  const matrix = [
    [xx, xz, x],
    [xz, zz, z],
    [x, z, points.length],
  ];
  const coeffX = solve3x3(matrix, [xpx, zpx, px]);
  const coeffY = solve3x3(matrix, [xpy, zpy, py]);

  if (!coeffX || !coeffY) return null;

  const transform = {
    meanX,
    meanZ,
    x: coeffX,
    y: coeffY,
  };
  const errors = points.map((point) => {
    const projected = projectWithTransform(transform, point.gameX, point.gameZ);
    return Math.hypot(projected.x - point.mapX, projected.y - point.mapY);
  });
  const rms = Math.sqrt(errors.reduce((sum, error) => sum + error * error, 0) / errors.length);
  const max = Math.max(...errors);

  return { transform, errors, rms, max };
}

function affineToMap(state) {
  if (!affineFit?.transform) return null;
  return projectWithTransform(affineFit.transform, finiteNumber(state.x), finiteNumber(state.z));
}

function worldToMap(state) {
  const affinePoint = affineToMap(state);
  if (affinePoint) return affinePoint;

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
  if (affineFit?.transform) {
    const transform = affineFit.transform;
    const [a, b, c] = transform.x;
    const [d, e, f] = transform.y;
    const det = a * e - b * d;

    if (Math.abs(det) > 1e-9) {
      const px = point.x - c;
      const py = point.y - f;
      return {
        x: transform.meanX + (e * px - b * py) / det,
        y: finiteNumber(latest.y),
        z: transform.meanZ + (-d * px + a * py) / det,
      };
    }
  }

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

function drawAffineReference() {
  ctx.fillStyle = 'rgba(4, 10, 14, 0.72)';
  ctx.fillRect(14, 14, 124, 26);
  ctx.fillStyle = '#d9fff7';
  ctx.font = '700 13px system-ui';
  ctx.fillText('Affine fit active', 24, 32);
}

function drawGrid() {
  if (affineFit?.transform) {
    drawAffineReference();
    return;
  }

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

function drawCalibrationPoints() {
  if (calibrationPoints.length === 0) return;

  ctx.save();
  ctx.font = '700 12px system-ui';

  calibrationPoints.forEach((point, index) => {
    const error = affineFit?.errors?.[index] ?? 0;
    const projected = affineFit?.transform
      ? projectWithTransform(affineFit.transform, point.gameX, point.gameZ)
      : null;

    if (projected) {
      ctx.strokeStyle = error > 12 ? 'rgba(255, 112, 96, 0.8)' : 'rgba(105, 255, 214, 0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(point.mapX, point.mapY);
      ctx.lineTo(projected.x, projected.y);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(4, 10, 14, 0.78)';
    ctx.strokeStyle = fields.calibrationMode?.checked
      ? 'rgba(255, 224, 112, 0.95)'
      : 'rgba(105, 255, 214, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(point.mapX, point.mapY, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(index + 1), point.mapX + 12, point.mapY + 4);
  });

  ctx.restore();
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
  drawCalibrationPoints();
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

function updateCalibrationUi() {
  affineFit = solveAffine(calibrationPoints);
  fields.calPointCount.textContent = `${calibrationPoints.length}/${TARGET_CALIBRATION_POINTS} points`;

  if (affineFit) {
    fields.calRms.textContent = `RMS ${affineFit.rms.toFixed(1)}px / max ${affineFit.max.toFixed(1)}px`;
  } else if (calibrationPoints.length < 3) {
    fields.calRms.textContent = 'Need 3+ points';
  } else {
    fields.calRms.textContent = 'Point spread is invalid';
  }

  fields.calPointList.replaceChildren();
  calibrationPoints.forEach((point, index) => {
    const row = document.createElement('tr');
    const error = affineFit?.errors?.[index];
    const cells = [
      String(index + 1),
      Math.round(point.gameX).toString(),
      Math.round(point.gameZ).toString(),
      `${Math.round(point.mapX)},${Math.round(point.mapY)}`,
      error === undefined ? '--' : error.toFixed(1),
    ];

    for (const value of cells) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.appendChild(cell);
    }

    fields.calPointList.appendChild(row);
  });
}

function addCalibrationPoint(point) {
  const gameX = finiteNumber(latest.x);
  const gameZ = finiteNumber(latest.z);

  if (!Number.isFinite(gameX) || !Number.isFinite(gameZ)) return;

  calibrationPoints.push({
    id: `${Date.now()}-${Math.random()}`,
    gameX,
    gameZ,
    mapX: point.x,
    mapY: point.y,
  });
  saveCalibrationPoints();
  updateCalibrationUi();
}

function mapPointFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function updateCursorText(event) {
  cursorMapPoint = mapPointFromEvent(event);

  const world = mapToWorld(cursorMapPoint);
  fields.cursor.textContent = `map ${cursorMapPoint.x.toFixed(0)}, ${cursorMapPoint.y.toFixed(0)} | world X ${world.x.toFixed(0)}, Z ${world.z.toFixed(0)}`;
}

canvas.addEventListener('click', (event) => {
  if (!fields.calibrationMode.checked) return;
  addCalibrationPoint(mapPointFromEvent(event));
});

canvas.addEventListener('mousemove', updateCursorText);
canvas.addEventListener('mouseleave', () => {
  cursorMapPoint = null;
  fields.cursor.textContent = 'Hover the map';
});

fields.undoCalPoint.addEventListener('click', () => {
  calibrationPoints.pop();
  saveCalibrationPoints();
  updateCalibrationUi();
});

fields.clearCalPoints.addEventListener('click', () => {
  calibrationPoints = [];
  saveCalibrationPoints();
  updateCalibrationUi();
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

updateCalibrationUi();
connect();
render();
