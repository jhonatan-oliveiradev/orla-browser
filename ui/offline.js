import { setIcon } from './icons.js';

const WIDTH = 576;
const HEIGHT = 224;
const FLOOR = 186;
const RUNNER_X = 78;
const SIZE = 36;
const IMPACT_DURATION = .64;
const PALETTE = ['', '#281522', '#fdf0fa', '#74224c', '#ffffff', '#dd4d9b'];
const wrap = (position, span) => ((position % span) + span) % span;
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
  const playLabel = document.getElementById('offline-play-label');
  setIcon(play, 'play');
  const scoreLabel = document.getElementById('offline-score');
  const recordLabel = document.getElementById('offline-record');
  const message = document.getElementById('offline-message');
  const ctx = canvas.getContext('2d');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
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
  let impact = 0;
  let impactStart = 0;

  function drawMascot() {
    const moving = !reducedMotion.matches;
    const stride = moving ? Math.floor(distance / 9) % 4 : 0;
    const airborne = y < FLOOR - SIZE;
    const hit = state === 'impact' || state === 'over';
    const pulse = Math.max(0, 1 - impact * 4);
    const bodyY = Math.round(y) - (!hit && !airborne && stride % 2 ? 2 : 0);

    ctx.save();
    ctx.translate(RUNNER_X, bodyY);
    if (hit && moving) {
      ctx.translate(-Math.round(impact * 17), -Math.round(Math.sin(impact * Math.PI) * 17));
      ctx.translate(20, 25);
      ctx.rotate(-impact * .36);
      ctx.scale(1 + pulse * .17, 1 - pulse * .29);
      ctx.translate(-20, -25);
    }
    const blink = moving && state === 'running' && Math.floor(distance) % 380 > 364;
    mascot.forEach((line, row) => {
      for (let column = 0; column < line.length; column++) {
        const pixel = line[column];
        if (pixel === '0') continue;
        if ((blink || hit) && ['3', '4'].includes(pixel) && row >= 7 && row <= 9) {
          ctx.fillStyle = row === 8 ? PALETTE[3] : PALETTE[2];
        } else {
          ctx.fillStyle = PALETTE[pixel];
        }
        const foot = column < 10 ? stride : (stride + 2) % 4;
        const lift = row === 17 && (airborne || foot === 1) ? 2 : 0;
        ctx.fillRect(column * 2, row * 2 - lift, 2, 2);
      }
    });
    ctx.restore();

    if (hit && moving && impact < 1) {
      for (let particle = 0; particle < 10; particle++) {
        const direction = particle % 2 === 0 ? -1 : 1;
        const x = RUNNER_X + 20 + direction * (10 + impact * (22 + particle * 3));
        const height = (18 + particle * 6) * impact - 46 * impact * impact;
        ctx.fillStyle = particle % 3 === 0 ? '#fff7fc' : '#ce247c';
        ctx.globalAlpha = 1 - impact;
        ctx.fillRect(Math.round(x), Math.round(bodyY + 12 - height), 3 + particle % 3, 3 + particle % 3);
      }
      ctx.globalAlpha = 1;
    }
  }

  function draw() {
    if (!ctx) return;
    ctx.fillStyle = '#ffe9f4';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = '#fff3fa';
    for (let x = 44; x < WIDTH; x += 144) {
      const offset = Math.round(wrap(x - distance * .07, WIDTH + 62)) - 62;
      const cloudY = 35 + x % 41;
      ctx.fillRect(offset, cloudY, 58, 8);
      ctx.fillRect(offset + 11, cloudY - 7, 33, 7);
      ctx.fillRect(offset + 18, cloudY - 13, 16, 6);
    }
    ctx.fillStyle = '#ffd2ea';
    for (let x = 0; x < WIDTH + 58; x += 58) {
      const offset = Math.round(wrap(x - distance * .13, WIDTH + 62)) - 62;
      const h = 14 + (x % 36);
      ctx.fillRect(offset, FLOOR - h, 58, h);
      ctx.fillRect(offset + 7, FLOOR - h - 7, 42, 8);
      ctx.fillRect(offset + 17, FLOOR - h - 15, 23, 8);
    }
    ctx.fillStyle = '#f37db8';
    for (let x = 0; x < WIDTH; x += 31) {
      const offset = Math.round(wrap(x - distance * .28, WIDTH));
      ctx.fillRect(offset, 54 + x % 62, 3, 3);
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

    drawMascot();
  }

  function updateScore() {
    scoreLabel.textContent = String(score);
    recordLabel.textContent = String(record);
  }

  function stop(next, announcement = '') {
    cancelAnimationFrame(frame);
    state = next;
    message.textContent = announcement;
    playLabel.textContent = next === 'paused' ? 'Continuar' : next === 'over' ? 'Jogar de novo' : 'Jogar';
    setIcon(play, next === 'over' ? 'reopen' : 'play', true);
  }

  function animateImpact(now) {
    impact = Math.min(1, (now - impactStart) / (IMPACT_DURATION * 1000));
    draw();
    if (impact < 1) frame = requestAnimationFrame(animateImpact);
    else state = 'over';
  }

  function finish(now) {
    if (score > record) {
      record = score;
      try { localStorage.setItem(RECORD_KEY, String(record)); } catch { /* Record stays in memory. */ }
    }
    updateScore();
    stop('over', 'Fim de jogo. Você fez ' + score + ' pontos.');
    if (reducedMotion.matches) {
      impact = 1;
      draw();
      return;
    }
    state = 'impact';
    impactStart = now;
    impact = 0;
    draw();
    frame = requestAnimationFrame(animateImpact);
  }

  function tick(now) {
    const dt = Math.min((now - last) / 1000, .032);
    last = now;
    const speed = 186 + Math.min(distance / 19, 104);
    distance += speed * dt;
    velocity += 730 * dt;
    y = Math.min(FLOOR - SIZE, y + velocity * dt);
    if (y === FLOOR - SIZE) velocity = 0;
    obstacle.x -= speed * dt;

    const overlaps = obstacle.x < RUNNER_X + 36 && obstacle.x + 20 > RUNNER_X + 6;
    if (overlaps && y + SIZE - 4 > FLOOR - obstacle.height - 4) {
      finish(now);
      return;
    }
    if (signal && overlaps && Math.abs(y + SIZE / 2 - (FLOOR - obstacle.height - 22)) < 17) {
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
    cancelAnimationFrame(frame);
    if (state !== 'paused') {
      impact = 0;
      score = 0;
      distance = 0;
      y = FLOOR - SIZE;
      velocity = 0;
      obstacle = { x: WIDTH - 40, height: 22 };
      signal = true;
      updateScore();
    }
    message.textContent = '';
    playLabel.textContent = 'Pausar';
    setIcon(play, 'pause', true);
    state = 'running';
    last = performance.now();
    frame = requestAnimationFrame(tick);
  }

  function jump() {
    if (state !== 'running') start();
    if (y === FLOOR - SIZE) velocity = -330;
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
    if (!document.hidden) return;
    if (state === 'running') stop('paused', 'Jogo pausado.');
    if (state === 'impact') endImpact();
  });
  updateScore();
  draw();

  function endImpact() {
    cancelAnimationFrame(frame);
    state = 'over';
    impact = 1;
    draw();
  }

  return (failure) => {
    panel.hidden = !failure;
    if (!failure && state === 'running') stop('paused', 'Jogo pausado.');
    if (!failure && state === 'impact') endImpact();
    if (failure) document.getElementById('offline-heading').textContent =
      failure === 'offline' ? 'Sem conexão' : 'Não foi possível abrir a página';
  };
}
