const WIDTH = 540;
const HEIGHT = 184;
const FLOOR = 151;
const RUNNER_X = 72;
const SIZE = 24;
const RECORD_KEY = 'orla.offline.record.v1';

const mascot = [
  '000011100000001110000000', '000122210000012221000000', '001222221111122222100000',
  '001222222222222222100000', '012222222222222222210000', '012222222222222222210000',
  '012222222222222222210000', '012223322222333222210000', '012223422222343222210000',
  '012223322222333222210000', '012222222232222222210000', '015522222222222255210000',
  '012222222222222222210000', '012222222222222222210000', '012222222222222222210000',
  '001222222222222222100000', '001111111111111111100000', '000110000000000110000000',
];

function bestScore() {
  try { return Math.max(0, Number(localStorage.getItem(RECORD_KEY)) || 0); }
  catch { return 0; }
}

export function initOffline() {
  const panel = document.getElementById('offline-view');
  const canvas = document.getElementById('offline-game');
  const play = document.getElementById('offline-play');
  const scoreLabel = document.getElementById('offline-score');
  const recordLabel = document.getElementById('offline-record');
  const message = document.getElementById('offline-message');
  const ctx = canvas.getContext('2d');
  let record = bestScore();
  let score = 0;
  let distance = 0;
  let y = FLOOR - SIZE;
  let velocity = 0;
  let obstacle = { x: WIDTH + 45, height: 22 };
  let signal = false;
  let frame = 0;
  let last = 0;
  let state = 'idle';

  function draw() {
    if (!ctx) return;
    ctx.fillStyle = '#ffe9f4';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = '#ffd2ea';
    for (let x = 18; x < WIDTH; x += 58) {
      const offset = Math.round((x - distance * .13) % WIDTH);
      const h = 13 + (x % 35);
      ctx.fillRect(offset, FLOOR - h, 52, h);
      ctx.fillRect(offset + 7, FLOOR - h - 6, 38, 7);
      ctx.fillRect(offset + 17, FLOOR - h - 12, 18, 6);
    }
    ctx.fillStyle = '#f37db8';
    for (let x = 0; x < WIDTH; x += 31) {
      const offset = Math.round((x - distance * .28) % WIDTH);
      ctx.fillRect(offset, 44 + x % 52, 3, 3);
    }
    ctx.fillStyle = '#3c1734';
    ctx.fillRect(0, FLOOR, WIDTH, 4);
    ctx.fillStyle = '#e853a0';
    ctx.fillRect(0, FLOOR + 4, WIDTH, HEIGHT - FLOOR - 4);
    ctx.fillStyle = '#b32b73';
    for (let x = 0; x < WIDTH + 24; x += 16) {
      const offset = x - Math.round(distance % 16);
      ctx.fillRect(offset, FLOOR + 8, 8, 5);
      ctx.fillRect(offset + 5, FLOOR + 18, 3, 3);
    }

    const x = Math.round(obstacle.x);
    ctx.fillStyle = '#7a2458';
    ctx.fillRect(x, FLOOR - obstacle.height, 20, obstacle.height);
    ctx.fillRect(x + 4, FLOOR - obstacle.height - 5, 12, 5);
    ctx.fillStyle = '#f876b7';
    ctx.fillRect(x + 4, FLOOR - obstacle.height + 4, 8, 5);
    if (signal) {
      ctx.fillStyle = '#d32481';
      ctx.fillRect(x + 7, FLOOR - obstacle.height - 29, 6, 14);
      ctx.fillRect(x + 3, FLOOR - obstacle.height - 25, 14, 6);
    }

    const colors = ['', '#281522', '#fdf0fa', '#74224c', '#ffffff', '#dd4d9b'];
    mascot.forEach((line, row) => [...line].forEach((pixel, column) => {
      if (pixel === '0') return;
      ctx.fillStyle = colors[pixel];
      ctx.fillRect(RUNNER_X + column, Math.round(y) + row + 5, 1, 1);
    }));
  }

  function updateScore() {
    scoreLabel.textContent = String(score);
    recordLabel.textContent = String(record);
  }

  function stop(next, announcement = '') {
    cancelAnimationFrame(frame);
    state = next;
    message.textContent = announcement;
    play.textContent = next === 'paused' ? 'Continuar' : next === 'over' ? 'Jogar de novo' : 'Jogar';
  }

  function tick(now) {
    const dt = Math.min((now - last) / 1000, .032);
    last = now;
    const speed = 176 + Math.min(distance / 17, 105);
    distance += speed * dt;
    velocity += 730 * dt;
    y = Math.min(FLOOR - SIZE, y + velocity * dt);
    if (y === FLOOR - SIZE) velocity = 0;
    obstacle.x -= speed * dt;

    const overlaps = obstacle.x < RUNNER_X + 20 && obstacle.x + 20 > RUNNER_X + 3;
    if (overlaps && y + SIZE - 3 > FLOOR - obstacle.height) {
      if (score > record) {
        record = score;
        try { localStorage.setItem(RECORD_KEY, String(record)); } catch { /* Record stays in memory. */ }
      }
      updateScore();
      stop('over', 'Fim de jogo. Você fez ' + score + ' pontos.');
      draw();
      return;
    }
    if (signal && overlaps && Math.abs(y + 12 - (FLOOR - obstacle.height - 22)) < 13) {
      score += 3;
      signal = false;
      updateScore();
    }
    if (obstacle.x < -25) {
      score += 1;
      obstacle = { x: WIDTH + 14 + Math.random() * 100, height: 18 + Math.floor(Math.random() * 12) };
      signal = true;
      updateScore();
    }
    draw();
    frame = requestAnimationFrame(tick);
  }

  function start() {
    if (state !== 'paused') {
      score = 0;
      distance = 0;
      y = FLOOR - SIZE;
      velocity = 0;
      obstacle = { x: WIDTH - 40, height: 22 };
      signal = true;
      updateScore();
    }
    message.textContent = '';
    play.textContent = 'Pausar';
    state = 'running';
    last = performance.now();
    frame = requestAnimationFrame(tick);
  }

  function jump() {
    if (state !== 'running') start();
    if (y === FLOOR - SIZE) velocity = -315;
  }

  play.addEventListener('click', () => {
    if (state === 'running') stop('paused', 'Jogo pausado.');
    else {
      start();
      canvas.focus();
    }
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    canvas.focus();
    jump();
  });
  canvas.addEventListener('keydown', (event) => {
    if ([' ', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      if (!event.repeat) jump();
    } else if (event.key === 'Escape' && state === 'running') {
      stop('paused', 'Jogo pausado.');
    }
  });
  canvas.addEventListener('blur', (event) => {
    if (state === 'running' && event.relatedTarget !== play) stop('paused', 'Jogo pausado.');
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === 'running') stop('paused', 'Jogo pausado.');
  });
  updateScore();
  draw();

  return (failure) => {
    panel.hidden = !failure;
    if (!failure && state === 'running') stop('paused', 'Jogo pausado.');
    if (failure) document.getElementById('offline-heading').textContent =
      failure === 'offline' ? 'Sem conexão' : 'Não foi possível abrir a página';
  };
}
