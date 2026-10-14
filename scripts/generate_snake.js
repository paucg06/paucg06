/**
 * Generador personalizado de animación de serpiente (Snake) para GitHub Profile
 * Combina las contribuciones de dos cuentas en el mismo tablero:
 *  - Cuenta Principal: paucg06 (bloques azules)
 *  - Cuenta Secundaria: Eterno-Dev (bloques amarillos)
 */

const fs = require('fs');
const https = require('https');
const path = require('path');

// --- Estructura y utilidades de cuadrícula (Grid) ---
const isInside = (grid, x, y) => x >= 0 && y >= 0 && x < grid.width && y < grid.height;
const isInsideLarge = (grid, m, x, y) => x >= -m && y >= -m && x < grid.width + m && y < grid.height + m;
const copyGrid = ({ width, height, data }) => ({
  width,
  height,
  data: Uint8Array.from(data)
});
const getIndex = (grid, x, y) => x * grid.height + y;
const getColor = (grid, x, y) => grid.data[getIndex(grid, x, y)];
const isEmpty = (color) => color === 0;
const setColor = (grid, x, y, color) => {
  grid.data[getIndex(grid, x, y)] = color || 0;
};
const setColorEmpty = (grid, x, y) => {
  setColor(grid, x, y, 0);
};
const createEmptyGrid = (width, height) => ({
  width,
  height,
  data: new Uint8Array(width * height)
});

// --- Serpiente (Snake) ---
const getHeadX = (snake) => snake[0] - 2;
const getHeadY = (snake) => snake[1] - 2;
const getSnakeLength = (snake) => snake.length / 2;
const snakeEquals = (a, b) => {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};
const nextSnake = (snake, dx, dy) => {
  const copy = new Uint8Array(snake.length);
  for (let i = 2; i < snake.length; i++) copy[i] = snake[i - 2];
  copy[0] = snake[0] + dx;
  copy[1] = snake[1] + dy;
  return copy;
};
const snakeWillSelfCollide = (snake, dx, dy) => {
  const nx = snake[0] + dx;
  const ny = snake[1] + dy;
  for (let i = 2; i < snake.length - 2; i += 2) {
    if (snake[i + 0] === nx && snake[i + 1] === ny) return true;
  }
  return false;
};
const snakeToCells = (snake) =>
  Array.from({ length: snake.length / 2 }, (_, i) => ({
    x: snake[i * 2 + 0] - 2,
    y: snake[i * 2 + 1] - 2
  }));
const createSnakeFromCells = (points) => {
  const snake = new Uint8Array(points.length * 2);
  for (let i = points.length; i--; ) {
    snake[i * 2 + 0] = points[i].x + 2;
    snake[i * 2 + 1] = points[i].y + 2;
  }
  return snake;
};
const createSnake4 = () =>
  createSnakeFromCells(Array.from({ length: 4 }, (_, i) => ({ x: i, y: -1 })));

// --- Utilidades SVG y CSS ---
const h = (element, attributes) => `<${element} ${toAttribute(attributes)}/>`;
const toAttribute = (o) =>
  Object.entries(o)
    .filter(([, value]) => value !== null)
    .map(([name, value]) => `${name}="${value}"`)
    .join(' ');
const percent = (x) => parseFloat((x * 100).toFixed(2)).toString() + '%';
const mergeKeyFrames = (keyframes) => {
  const s = new Map();
  for (const { t, style } of keyframes) {
    s.set(style, [...(s.get(style) ?? []), t]);
  }
  return Array.from(s.entries())
    .map(([style, ts]) => ({ style, ts }))
    .sort((a, b) => a.ts[0] - b.ts[0]);
};
const createAnimation = (name, keyframes) =>
  `@keyframes ${name}{` +
  mergeKeyFrames(keyframes)
    .map(({ style, ts }) => ts.map(percent).join(',') + `{${style}}`)
    .join('') +
  '}';
const minifyCss = (css) =>
  css
    .replace(/\s+/g, ' ')
    .replace(/.\s+[,;:{}()]/g, (a) => a.replace(/\s+/g, ''))
    .replace(/[,;:{}()]\s+./g, (a) => a.replace(/\s+/g, ''))
    .replace(/.\s+[,;:{}()]/g, (a) => a.replace(/\s+/g, ''))
    .replace(/[,;:{}()]\s+./g, (a) => a.replace(/\s+/g, ''))
    .replace(/;\s*\}/g, '}')
    .trim();

const lerp = (k, a, b) => (1 - k) * a + k * b;

const removeInterpolatedPositions = (arr) =>
  arr.filter((u, i, arr2) => {
    if (i - 1 < 0 || i + 1 >= arr2.length) return true;
    const a = arr2[i - 1];
    const b = arr2[i + 1];
    const ex = (a.x + b.x) / 2;
    const ey = (a.y + b.y) / 2;
    return !(Math.abs(ex - u.x) < 0.01 && Math.abs(ey - u.y) < 0.01);
  });

const createSnakeSvg = (chain, { sizeCell, sizeDot }, duration) => {
  const snakeN = chain[0] ? getSnakeLength(chain[0]) : 0;
  const snakeParts = Array.from({ length: snakeN }, () => []);
  for (const snake of chain) {
    const cells = snakeToCells(snake);
    for (let i = cells.length; i--; ) snakeParts[i].push(cells[i]);
  }
  const svgElements = snakeParts.map((_, i, { length }) => {
    const dMin = sizeDot * 0.8;
    const dMax = sizeCell * 0.9;
    const iMax = Math.min(4, length);
    const u = (1 - Math.min(i, iMax) / iMax) ** 2;
    const s = lerp(u, dMin, dMax);
    const m = (sizeCell - s) / 2;
    const r = Math.min(4.5, (4 * s) / sizeDot);
    return h('rect', {
      class: `s s${i}`,
      x: m.toFixed(1),
      y: m.toFixed(1),
      width: s.toFixed(1),
      height: s.toFixed(1),
      rx: r.toFixed(1),
      ry: r.toFixed(1)
    });
  });
  const transform = ({ x, y }) => `transform:translate(${x * sizeCell}px,${y * sizeCell}px)`;
  const styles = [
    `.s{ 
      shape-rendering: geometricPrecision;
      fill: var(--cs);
      animation: none linear ${duration}ms infinite
    }`,
    ...snakeParts.flatMap((positions, i) => {
      const id = `s${i}`;
      const animationName = id;
      const keyframes = removeInterpolatedPositions(
        positions.map((tr, i2, { length }) => ({ ...tr, t: i2 / length }))
      ).map(({ t, ...p }) => ({ t, style: transform(p) }));
      return [
        createAnimation(animationName, keyframes),
        `.s.${id}{
          ${transform(positions[0])};
          animation-name: ${animationName}
        }`
      ];
    })
  ];
  return { svgElements, styles };
};

const createGridSvg = (cells, { sizeDotBorderRadius, sizeDot, sizeCell }, duration) => {
  const svgElements = [];
  const styles = [
    `.c{
      shape-rendering: geometricPrecision;
      fill: var(--ce);
      stroke-width: 1px;
      stroke: var(--cb);
      animation: none ${duration}ms linear infinite;
      width: ${sizeDot}px;
      height: ${sizeDot}px;
    }`
  ];

  let i = 0;
  for (const { x, y, color, t } of cells) {
    const id = t !== null && 'c' + (i++).toString(36);
    const m = (sizeCell - sizeDot) / 2;

    if (t !== null && id) {
      const animationName = id;
      styles.push(
        createAnimation(animationName, [
          { t: t - 0.0001, style: `fill:var(--c${color})` },
          { t: t + 0.0001, style: `fill:var(--ce)` },
          { t: 1, style: `fill:var(--ce)` }
        ]),
        `.c.${id}{
          fill: var(--c${color});
          animation-name: ${animationName}
        }`
      );
    }

    svgElements.push(
      h('rect', {
        class: ['c', id].filter(Boolean).join(' '),
        x: x * sizeCell + m,
        y: y * sizeCell + m,
        rx: sizeDotBorderRadius,
        ry: sizeDotBorderRadius
      })
    );
  }
  return { svgElements, styles };
};

const createStackSvg = (cells, { sizeDot }, width, y, duration) => {
  const svgElements = [];
  const styles = [
    `.u{ 
      transform-origin: 0 0;
      transform: scale(0,1);
      animation: none linear ${duration}ms infinite;
    }`
  ];

  const stack = cells
    .slice()
    .filter((a) => a.t !== null)
    .sort((a, b) => a.t - b.t);

  const blocks = [];
  stack.forEach(({ color, t }) => {
    const latest = blocks[blocks.length - 1];
    if (latest?.color === color) latest.ts.push(t);
    else blocks.push({ color, ts: [t] });
  });

  const m = width / stack.length;
  let i = 0;
  let nx = 0;
  for (const { color, ts } of blocks) {
    const id = 'u' + (i++).toString(36);
    const animationName = id;
    const x = (nx * m).toFixed(1);
    nx += ts.length;

    svgElements.push(
      h('rect', {
        class: `u ${id}`,
        height: sizeDot,
        width: (ts.length * m + 0.6).toFixed(1),
        x,
        y
      })
    );

    styles.push(
      createAnimation(
        animationName,
        [
          ...ts.flatMap((t, i2, { length }) => [
            { scale: i2 / length, t: t - 0.0001 },
            { scale: (i2 + 1) / length, t: t + 0.0001 }
          ]),
          { scale: 1, t: 1 }
        ].map(({ scale, t }) => ({
          t,
          style: `transform:scale(${scale.toFixed(3)},1)`
        }))
      ),
      `.u.${id} {
        fill: var(--c${color});
        animation-name: ${animationName};
        transform-origin: ${x}px 0
      }`
    );
  }
  return { svgElements, styles };
};

const getCellsFromGrid = ({ width, height }) =>
  Array.from({ length: width }, (_, x) =>
    Array.from({ length: height }, (_, y) => ({ x, y }))
  ).flat();

const createLivingCells = (grid0, chain, cells) => {
  const livingCells = (cells ?? getCellsFromGrid(grid0)).map(({ x, y }) => ({
    x,
    y,
    t: null,
    color: getColor(grid0, x, y)
  }));
  const grid = copyGrid(grid0);
  for (let i = 0; i < chain.length; i++) {
    const snake = chain[i];
    const x = getHeadX(snake);
    const y = getHeadY(snake);
    if (isInside(grid, x, y) && !isEmpty(getColor(grid, x, y))) {
      setColorEmpty(grid, x, y);
      const cell = livingCells.find((c) => c.x === x && c.y === y);
      if (cell) cell.t = i / chain.length;
    }
  }
  return livingCells;
};

const generateColorVar = (drawOptions) =>
  `
    :root {
    --cb: ${drawOptions.colorDotBorder};
    --cs: ${drawOptions.colorSnake};
    --ce: ${drawOptions.colorEmpty};
    ${Object.entries(drawOptions.colorDots)
      .map(([i, color]) => `--c${i}:${color};`)
      .join('')}
    }
    ` +
  (drawOptions.dark
    ? `
    @media (prefers-color-scheme: dark) {
      :root {
        --cb: ${drawOptions.dark.colorDotBorder || drawOptions.colorDotBorder};
        --cs: ${drawOptions.dark.colorSnake || drawOptions.colorSnake};
        --ce: ${drawOptions.dark.colorEmpty};
        ${Object.entries(drawOptions.dark.colorDots)
          .map(([i, color]) => `--c${i}:${color};`)
          .join('')}
      }
    }
`
    : '');

const createSvg = (grid, cells, chain, drawOptions, animationOptions) => {
  const width = (grid.width + 2) * drawOptions.sizeCell;
  const height = (grid.height + 5) * drawOptions.sizeCell;
  const duration = animationOptions.stepDurationMs * chain.length;
  const livingCells = createLivingCells(grid, chain, cells);
  const elements = [
    createGridSvg(livingCells, drawOptions, duration),
    createStackSvg(
      livingCells,
      drawOptions,
      grid.width * drawOptions.sizeCell,
      (grid.height + 2) * drawOptions.sizeCell,
      duration
    ),
    createSnakeSvg(chain, drawOptions, duration)
  ];
  const viewBox = [-drawOptions.sizeCell, -drawOptions.sizeCell * 2, width, height].join(' ');
  const style =
    generateColorVar(drawOptions) +
    elements
      .flatMap((e) => e.styles)
      .join('\n');

  const svg = [
    h('svg', {
      viewBox,
      width,
      height,
      xmlns: 'http://www.w3.org/2000/svg'
    }).replace('/>', '>'),
    '<desc>Generated with custom multi-user snake generator for paucg06 & Eterno-Dev</desc>',
    '<style>',
    minifyCss(style),
    '</style>',
    ...elements.flatMap((e) => e.svgElements),
    '</svg>'
  ].join('');

  return svg;
};

// --- Algoritmo de Búsqueda de Camino (Solver) ---
const around4 = [
  { x: 1, y: 0 },
  { x: 0, y: -1 },
  { x: -1, y: 0 },
  { x: 0, y: 1 }
];

const createOutside = (grid, color = 0) => {
  const outside = createEmptyGrid(grid.width, grid.height);
  for (let x = outside.width; x--; ) {
    for (let y = outside.height; y--; ) setColor(outside, x, y, 1);
  }
  fillOutside(outside, grid, color);
  return outside;
};

const fillOutside = (outside, grid, color = 0) => {
  let changed = true;
  while (changed) {
    changed = false;
    for (let x = outside.width; x--; ) {
      for (let y = outside.height; y--; ) {
        if (
          getColor(grid, x, y) <= color &&
          !isOutside(outside, x, y) &&
          around4.some((a) => isOutside(outside, x + a.x, y + a.y))
        ) {
          changed = true;
          setColorEmpty(outside, x, y);
        }
      }
    }
  }
  return outside;
};

const isOutside = (outside, x, y) => !isInside(outside, x, y) || isEmpty(getColor(outside, x, y));

const sortPush = (arr, x, sortFn) => {
  let a = 0;
  let b = arr.length;
  if (arr.length === 0 || sortFn(x, arr[a]) <= 0) {
    arr.unshift(x);
    return;
  }
  while (b - a > 1) {
    const e2 = Math.ceil((a + b) / 2);
    const s = sortFn(x, arr[e2]);
    if (s === 0) a = b = e2;
    else if (s > 0) a = e2;
    else b = e2;
  }
  const e = Math.ceil((a + b) / 2);
  arr.splice(e, 0, x);
};

const getTunnelPath = (snake0, tunnel) => {
  const chain = [];
  let snake = snake0;
  for (let i = 1; i < tunnel.length; i++) {
    const dx = tunnel[i].x - getHeadX(snake);
    const dy = tunnel[i].y - getHeadY(snake);
    snake = nextSnake(snake, dx, dy);
    chain.unshift(snake);
  }
  return chain;
};

const isEmptySafe = (grid, x, y) => !isInside(grid, x, y) || isEmpty(getColor(grid, x, y));

const trimTunnelStart = (grid, tunnel) => {
  while (tunnel.length) {
    const { x, y } = tunnel[0];
    if (isEmptySafe(grid, x, y)) tunnel.shift();
    else break;
  }
};

const trimTunnelEnd = (grid, tunnel) => {
  while (tunnel.length) {
    const i = tunnel.length - 1;
    const { x, y } = tunnel[i];
    if (isEmptySafe(grid, x, y) || tunnel.findIndex((p) => p.x === x && p.y === y) < i) {
      tunnel.pop();
    } else break;
  }
};

const getColorSafe = (grid, x, y) => (isInside(grid, x, y) ? getColor(grid, x, y) : 0);
const setEmptySafe = (grid, x, y) => {
  if (isInside(grid, x, y)) setColorEmpty(grid, x, y);
};
const unwrap = (m) => (!m ? [] : [...unwrap(m.parent), { x: getHeadX(m.snake), y: getHeadY(m.snake) }]);

const getSnakeEscapePath = (grid, outside, snake0, color) => {
  const openList = [{ snake: snake0, w: 0 }];
  const closeList = [];
  while (openList[0]) {
    const o = openList.shift();
    const x = getHeadX(o.snake);
    const y = getHeadY(o.snake);
    if (isOutside(outside, x, y)) return unwrap(o);
    for (const a of around4) {
      const c = getColorSafe(grid, x + a.x, y + a.y);
      if (c <= color && !snakeWillSelfCollide(o.snake, a.x, a.y)) {
        const snake = nextSnake(o.snake, a.x, a.y);
        if (!closeList.some((s0) => snakeEquals(s0, snake))) {
          const w = o.w + 1 + +(c === color) * 1000;
          sortPush(openList, { snake, w, parent: o }, (a2, b) => a2.w - b.w);
          closeList.push(snake);
        }
      }
    }
  }
  return null;
};

const getBestTunnel = (grid, outside, x, y, color, snakeN) => {
  const c = { x, y };
  const snake0 = createSnakeFromCells(Array.from({ length: snakeN }, () => c));
  const one = getSnakeEscapePath(grid, outside, snake0, color);
  if (!one) return null;
  const snakeICells = one.slice(0, snakeN);
  while (snakeICells.length < snakeN) snakeICells.push(snakeICells[snakeICells.length - 1]);
  const snakeI = createSnakeFromCells(snakeICells);
  const gridI = copyGrid(grid);
  for (const { x: x2, y: y2 } of one) setEmptySafe(gridI, x2, y2);
  const two = getSnakeEscapePath(gridI, outside, snakeI, color);
  if (!two) return null;
  one.shift();
  one.reverse();
  one.push(...two);
  trimTunnelStart(grid, one);
  trimTunnelEnd(grid, one);
  return one;
};

const getPathTo = (grid, snake0, x, y) => {
  const openList = [{ snake: snake0, w: 0 }];
  const closeList = [];
  while (openList.length) {
    const c = openList.shift();
    const cx = getHeadX(c.snake);
    const cy = getHeadY(c.snake);
    for (let i = 0; i < around4.length; i++) {
      const { x: dx, y: dy } = around4[i];
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx === x && ny === y) {
        const path = [nextSnake(c.snake, dx, dy)];
        let e = c;
        while (e.parent) {
          path.push(e.snake);
          e = e.parent;
        }
        return path;
      }
      if (
        isInsideLarge(grid, 2, nx, ny) &&
        !snakeWillSelfCollide(c.snake, dx, dy) &&
        (!isInside(grid, nx, ny) || isEmpty(getColor(grid, nx, ny)))
      ) {
        const nsnake = nextSnake(c.snake, dx, dy);
        if (!closeList.some((s) => snakeEquals(nsnake, s))) {
          const w = c.w + 1;
          const h = Math.abs(nx - x) + Math.abs(ny - y);
          const f = w + h;
          const o = { snake: nsnake, parent: c, w, h, f };
          sortPush(openList, o, (a, b) => a.f - b.f);
          closeList.push(nsnake);
        }
      }
    }
  }
};

const distanceSq = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;

const getPriority = (grid, color, tunnel) => {
  let nColor = 0;
  let nLess = 0;
  for (let i = 0; i < tunnel.length; i++) {
    const { x, y } = tunnel[i];
    const c = getColorSafe(grid, x, y);
    if (!isEmpty(c) && i === tunnel.findIndex((p) => p.x === x && p.y === y)) {
      if (c === color) nColor += 1;
      else nLess += color - c;
    }
  }
  if (nColor === 0) return 99999;
  return nLess / nColor;
};

const getTunnellablePoints = (grid, outside, snakeN, color) => {
  const points = [];
  for (let x = grid.width; x--; ) {
    for (let y = grid.height; y--; ) {
      const c = getColor(grid, x, y);
      if (!isEmpty(c) && c < color) {
        const tunnel = getBestTunnel(grid, outside, x, y, color, snakeN);
        if (tunnel) {
          const priority = getPriority(grid, color, tunnel);
          points.push({ x, y, priority, tunnel });
        }
      }
    }
  }
  return points;
};

const getNextTunnel = (ts, snake) => {
  let minDistance = Infinity;
  let closestTunnel = null;
  const x = getHeadX(snake);
  const y = getHeadY(snake);
  const priority = ts[0].priority;
  for (let i = 0; ts[i] && ts[i].priority === priority; i++) {
    const t = ts[i].tunnel;
    const d = distanceSq(t[0].x, t[0].y, x, y);
    if (d < minDistance) {
      minDistance = d;
      closestTunnel = t;
    }
  }
  return closestTunnel;
};

const clearResidualColoredLayer = (grid, outside, snake0, color) => {
  const snakeN = getSnakeLength(snake0);
  const tunnels = getTunnellablePoints(grid, outside, snakeN, color);
  tunnels.sort((a, b) => b.priority - a.priority);
  const chain = [snake0];
  while (tunnels.length) {
    let t = getNextTunnel(tunnels, chain[0]);
    chain.unshift(...getPathTo(grid, chain[0], t[0].x, t[0].y));
    chain.unshift(...getTunnelPath(chain[0], t));
    for (const { x, y } of t) setEmptySafe(grid, x, y);
    fillOutside(outside, grid);
    for (let i = tunnels.length; i--; ) {
      if (isEmpty(getColor(grid, tunnels[i].x, tunnels[i].y))) {
        tunnels.splice(i, 1);
      } else {
        const t2 = tunnels[i];
        const tunnel = getBestTunnel(grid, outside, t2.x, t2.y, color, snakeN);
        if (!tunnel) tunnels.splice(i, 1);
        else {
          t2.tunnel = tunnel;
          t2.priority = getPriority(grid, color, tunnel);
        }
      }
    }
    tunnels.sort((a, b) => b.priority - a.priority);
  }
  chain.pop();
  return chain;
};

const unwrap2 = (m) => (!m ? [] : [m.snake, ...unwrap2(m.parent)]);

const getPathToNextPoint = (grid, snake0, color, points) => {
  const closeList = [];
  const openList = [{ snake: snake0 }];
  while (openList.length) {
    const o = openList.shift();
    const x = getHeadX(o.snake);
    const y = getHeadY(o.snake);
    const i = points.findIndex((p) => p.x === x && p.y === y);
    if (i >= 0) {
      points.splice(i, 1);
      return unwrap2(o);
    }
    for (const { x: dx, y: dy } of around4) {
      if (
        isInsideLarge(grid, 2, x + dx, y + dy) &&
        !snakeWillSelfCollide(o.snake, dx, dy) &&
        getColorSafe(grid, x + dx, y + dy) <= color
      ) {
        const snake = nextSnake(o.snake, dx, dy);
        if (!closeList.some((s0) => snakeEquals(s0, snake))) {
          closeList.push(snake);
          openList.push({ snake, parent: o });
        }
      }
    }
  }
};

const getTunnellablePoints2 = (grid, outside, snakeN, color) => {
  const points = [];
  for (let x = grid.width; x--; ) {
    for (let y = grid.height; y--; ) {
      const c = getColor(grid, x, y);
      if (!isEmpty(c) && c <= color && !points.some((p) => p.x === x && p.y === y)) {
        const tunnel = getBestTunnel(grid, outside, x, y, color, snakeN);
        if (tunnel) {
          for (const p of tunnel) {
            if (!isInside(grid, p.x, p.y) && isEmpty(getColor(grid, p.x, p.y))) {
              // empty safe
            } else {
              points.push(p);
            }
          }
        }
      }
    }
  }
  return points;
};

const clearCleanColoredLayer = (grid, outside, snake0, color) => {
  const snakeN = getSnakeLength(snake0);
  const points = getTunnellablePoints2(grid, outside, snakeN, color);
  const chain = [snake0];
  while (points.length) {
    const path = getPathToNextPoint(grid, chain[0], color, points);
    path.pop();
    for (const snake of path) setEmptySafe(grid, getHeadX(snake), getHeadY(snake));
    chain.unshift(...path);
  }
  fillOutside(outside, grid);
  chain.pop();
  return chain;
};

const extractColors = (grid) => {
  let maxColor = Math.max(...grid.data);
  return Array.from({ length: maxColor }, (_, i) => i + 1);
};

const getBestRoute = (grid0, snake0) => {
  const grid = copyGrid(grid0);
  const outside = createOutside(grid);
  const chain = [snake0];
  for (const color of extractColors(grid)) {
    if (color > 1) {
      chain.unshift(...clearResidualColoredLayer(grid, outside, chain[0], color));
    }
    chain.unshift(...clearCleanColoredLayer(grid, outside, chain[0], color));
  }
  return chain.reverse();
};

const isEmptySafe3 = (grid, x, y) => !isInside(grid, x, y) || isEmpty(getColor(grid, x, y));

const getPathToPose = (snake0, target, grid) => {
  if (snakeEquals(snake0, target)) return [];
  const targetCells = snakeToCells(target).reverse();
  const snakeN = getSnakeLength(snake0);
  const box = {
    min: {
      x: Math.min(getHeadX(snake0), getHeadX(target)) - snakeN - 1,
      y: Math.min(getHeadY(snake0), getHeadY(target)) - snakeN - 1
    },
    max: {
      x: Math.max(getHeadX(snake0), getHeadX(target)) + snakeN + 1,
      y: Math.max(getHeadY(snake0), getHeadY(target)) + snakeN + 1
    }
  };
  const [t0, ...forbidden] = targetCells;
  forbidden.slice(0, 3);
  const openList = [{ snake: snake0, w: 0 }];
  const closeList = [];
  while (openList.length) {
    const o = openList.shift();
    const x = getHeadX(o.snake);
    const y = getHeadY(o.snake);
    if (x === t0.x && y === t0.y) {
      const path = [];
      let e = o;
      while (e) {
        path.push(e.snake);
        e = e.parent;
      }
      path.unshift(...getTunnelPath(path[0], targetCells));
      path.pop();
      path.reverse();
      return path;
    }
    for (let i = 0; i < around4.length; i++) {
      const { x: dx, y: dy } = around4[i];
      const nx = x + dx;
      const ny = y + dy;
      if (
        !snakeWillSelfCollide(o.snake, dx, dy) &&
        (!grid || isEmptySafe3(grid, nx, ny)) &&
        (grid
          ? isInsideLarge(grid, 2, nx, ny)
          : box.min.x <= nx && nx <= box.max.x && box.min.y <= ny && ny <= box.max.y) &&
        !forbidden.some((p) => p.x === nx && p.y === ny)
      ) {
        const snake = nextSnake(o.snake, dx, dy);
        if (!closeList.some((s) => snakeEquals(snake, s))) {
          const w = o.w + 1;
          const h = Math.abs(nx - x) + Math.abs(ny - y);
          const f = w + h;
          sortPush(openList, { f, w, snake, parent: o }, (a, b) => a.f - b.f);
          closeList.push(snake);
        }
      }
    }
  }
};

// --- Mapeo de celdas a Grid ---
const cellsToGrid = (cells) => {
  const width = Math.max(0, ...cells.map((c) => c.x)) + 1;
  const height = Math.max(0, ...cells.map((c) => c.y)) + 1;
  const grid = createEmptyGrid(width, height);
  for (const c of cells) {
    if (c.level > 0) setColor(grid, c.x, c.y, c.level);
    else setColorEmpty(grid, c.x, c.y);
  }
  return grid;
};

// --- Obtención de Contribuciones ---
function fetchContributionsScrape(username) {
  return new Promise((resolve, reject) => {
    const url = `https://github.com/users/${username}/contributions`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        const regex =
          /<td[^>]+data-date="([^"]+)"[^>]+id="contribution-day-component-(\d+)-(\d+)"[^>]+data-level="(\d+)"/g;
        let match;
        const days = [];
        while ((match = regex.exec(data)) !== null) {
          days.push({
            date: match[1],
            y: parseInt(match[2], 10),
            x: parseInt(match[3], 10),
            level: parseInt(match[4], 10)
          });
        }
        resolve(days);
      }).on('error', reject);
    });
  });
}

async function getUserContributions(username, token) {
  if (token) {
    try {
      const query = `
        query ($login: String!) {
          user(login: $login) {
            contributionsCollection {
              contributionCalendar {
                weeks {
                  contributionDays {
                    contributionCount
                    contributionLevel
                    weekday
                    date
                  }
                }
              }
            }
          }
        }
      `;
      const res = await fetch('https://api.github.com/graphql', {
        headers: {
          Authorization: `bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Snake-Sync-Antigravity'
        },
        method: 'POST',
        body: JSON.stringify({ variables: { login: username }, query })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data?.user?.contributionsCollection?.contributionCalendar) {
          const weeks = json.data.user.contributionsCollection.contributionCalendar.weeks;
          return weeks.flatMap(({ contributionDays }, x) =>
            contributionDays.map((d) => ({
              x,
              y: d.weekday,
              date: d.date,
              count: d.contributionCount,
              level:
                (d.contributionLevel === 'FOURTH_QUARTILE' && 4) ||
                (d.contributionLevel === 'THIRD_QUARTILE' && 3) ||
                (d.contributionLevel === 'SECOND_QUARTILE' && 2) ||
                (d.contributionLevel === 'FIRST_QUARTILE' && 1) ||
                0
            }))
          );
        }
      }
    } catch (e) {
      console.warn(`Aviso: fallo en GraphQL para ${username}, usando raspado web público:`, e.message);
    }
  }
  return fetchContributionsScrape(username);
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  console.log('Obteniendo calendario de contribuciones para paucg06 y Eterno-Dev...');

  const [paucgCells, eternoCells] = await Promise.all([
    getUserContributions('paucg06', token),
    getUserContributions('Eterno-Dev', token)
  ]);

  console.log(`Contribuciones obtenidas: paucg06=${paucgCells.length} celdas, Eterno-Dev=${eternoCells.length} celdas`);

  // Crear mapa indexado por fecha para Eterno-Dev
  const eternoMap = new Map();
  for (const c of eternoCells) {
    if (c.level > 0) eternoMap.set(c.date, c);
  }

  // Fusión de celdas:
  // paucg06 niveles 1..4: gama azul
  // Eterno-Dev niveles 1..4 mapeados a 5..8: gama amarilla
  const mergedCells = paucgCells.map((c) => {
    const et = eternoMap.get(c.date);
    if (et && et.level > 0) {
      // Si Eterno-Dev tiene commits en este día, asignamos nivel amarillo (5 a 8)
      return {
        ...c,
        level: 4 + Math.max(1, Math.min(4, et.level)),
        account: 'Eterno-Dev'
      };
    }
    return {
      ...c,
      account: c.level > 0 ? 'paucg06' : 'none'
    };
  });

  const blueCount = mergedCells.filter((c) => c.level >= 1 && c.level <= 4).length;
  const yellowCount = mergedCells.filter((c) => c.level >= 5).length;
  console.log(`Tablero combinado con éxito: ${blueCount} bloques azules (paucg06) y ${yellowCount} bloques amarillos (Eterno-Dev)`);

  const grid = cellsToGrid(mergedCells);
  const snake = createSnake4();

  console.log('Calculando la ruta óptima de la serpiente para comer todos los bloques...');
  const chain = getBestRoute(grid, snake);
  chain.push(...getPathToPose(chain.slice(-1)[0], snake));
  console.log(`Ruta calculada con ${chain.length} fotogramas/pasos.`);

  const animationOptions = { stepDurationMs: 100, frameByStep: 1 };

  // Opciones Tema Claro:
  // Serpiente: #953800
  // Celdas vacías: #f6f8fa
  // Niveles 1..4 (Azul paucg06): #c2cfde, #659ad2, #2160c4, #0a3069
  // Niveles 5..8 (Amarillo Eterno-Dev): #fff3a8, #ffd84d, #f5b700, #c68a00
  const lightDrawOptions = {
    colorDotBorder: '#1b1f230a',
    colorEmpty: '#f6f8fa',
    colorSnake: '#953800',
    sizeCell: 16,
    sizeDot: 12,
    sizeDotBorderRadius: 2,
    colorDots: {
      1: '#c2cfde',
      2: '#659ad2',
      3: '#2160c4',
      4: '#0a3069',
      5: '#fff3a8',
      6: '#ffd84d',
      7: '#f5b700',
      8: '#c68a00'
    }
  };

  // Opciones Tema Oscuro:
  // Serpiente: #ffa657
  // Celdas vacías: #161b22
  // Niveles 1..4 (Azul paucg06): #1f3d66, #2c5a96, #4182d6, #a5d6ff
  // Niveles 5..8 (Amarillo Eterno-Dev): #7a5f00, #b38b00, #e6b800, #ffeb3b
  const darkDrawOptions = {
    colorDotBorder: '#1b1f230a',
    colorEmpty: '#161b22',
    colorSnake: '#ffa657',
    sizeCell: 16,
    sizeDot: 12,
    sizeDotBorderRadius: 2,
    colorDots: {
      1: '#1f3d66',
      2: '#2c5a96',
      3: '#4182d6',
      4: '#a5d6ff',
      5: '#7a5f00',
      6: '#b38b00',
      7: '#e6b800',
      8: '#ffeb3b'
    }
  };

  console.log('Generando animaciones SVG...');
  const lightSvg = createSvg(grid, mergedCells, chain, lightDrawOptions, animationOptions);
  const darkSvg = createSvg(grid, mergedCells, chain, darkDrawOptions, animationOptions);

  const baseDir = path.join(__dirname, '..');
  const distDir = path.join(baseDir, 'dist');
  fs.mkdirSync(distDir, { recursive: true });

  fs.writeFileSync(path.join(distDir, 'github-snake.svg'), lightSvg, 'utf-8');
  fs.writeFileSync(path.join(distDir, 'github-snake-dark.svg'), darkSvg, 'utf-8');
  console.log(`Archivos guardados en ${distDir}/: github-snake.svg y github-snake-dark.svg`);
}

main().catch((err) => {
  console.error('Error generando animación de serpiente:', err);
  process.exit(1);
});
