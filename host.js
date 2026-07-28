import { QUESTION_BY_ID, chooseQuestionIds } from './questions.js';
import {
  backendMode,
  currentUserId,
  getValue,
  ready,
  serverNow,
  setValue,
  subscribe,
  updateMany,
  updateValue,
} from './store.js';
import {
  $,
  letters,
  makeCode,
  renderLeaderboard,
  scoreAnswer,
  sortedPlayers,
} from './common.js';

const state = {
  code: '',
  room: null,
  players: {},
  answers: {},
  timer: null,
  unsubRoom: null,
  unsubPlayers: null,
  unsubAnswers: null,
  processingAnswers: new Set(),
  scoredAnswers: new Set(),
};

const sections = ['setup-section', 'lobby-section', 'game-section', 'finish-section'];
const show = (id) => sections.forEach((section) => $(section).classList.toggle('hidden', section !== id));

function mode() {
  if (backendMode === 'demo') {
    $('mode-banner').classList.remove('hidden');
    $('mode-banner').innerHTML = '<strong>Demo mode:</strong> synchronization works between tabs in this browser. Add Firebase settings before the event for real phones.';
  }
}

async function createRoom() {
  let code = makeCode();
  while (await getValue(`rooms/${code}`)) code = makeCode();

  await setValue(`rooms/${code}`, {
    code,
    hostUid: currentUserId() || 'demo-host',
    status: 'lobby',
    phase: 'lobby',
    createdAt: serverNow(),
    questionIds: chooseQuestionIds(Number($('question-count-select').value)),
    questionIndex: -1,
    durationSeconds: Number($('duration-select').value),
    players: {},
    answers: {},
  });

  state.code = code;
  history.replaceState({}, '', `?room=${code}`);
  listen();
}

function listen() {
  state.unsubRoom?.();
  state.unsubPlayers?.();
  state.unsubAnswers?.();

  state.unsubRoom = subscribe(`rooms/${state.code}`, (room) => {
    if (!room) return;
    state.room = room;
    renderRoom();
    processUnscoredAnswers();
  });

  state.unsubPlayers = subscribe(`rooms/${state.code}/players`, (players) => {
    state.players = players || {};
    renderPlayers();
  });

  state.unsubAnswers = subscribe(`rooms/${state.code}/answers`, (answers) => {
    state.answers = answers || {};
    renderResponses();
    processUnscoredAnswers();
  });
}

async function processUnscoredAnswers() {
  const room = state.room;
  if (!room || room.questionIndex < 0) return;

  const question = QUESTION_BY_ID[room.questionIds?.[room.questionIndex]];
  if (!question) return;

  const answers = state.answers?.[room.questionIndex] || {};
  for (const [playerId, answer] of Object.entries(answers)) {
    const key = `${room.questionIndex}/${playerId}`;
    if (answer.scoredAt || state.processingAnswers.has(key) || state.scoredAnswers.has(key)) continue;

    state.processingAnswers.add(key);
    try {
      const player = await getValue(`rooms/${state.code}/players/${playerId}`);
      if (!player) continue;

      const correct = answer.choice === question.correct;
      const points = scoreAnswer({
        correct,
        elapsedMs: answer.elapsedMs || 0,
        durationMs: (room.durationSeconds || 20) * 1000,
      });
      const scoredAt = serverNow();

      await updateMany({
        [`rooms/${state.code}/players/${playerId}/score`]: (player.score || 0) + points,
        [`rooms/${state.code}/players/${playerId}/correct`]: (player.correct || 0) + (correct ? 1 : 0),
        [`rooms/${state.code}/players/${playerId}/answered`]: (player.answered || 0) + 1,
        [`rooms/${state.code}/players/${playerId}/lastSeen`]: scoredAt,
        [`rooms/${state.code}/answers/${room.questionIndex}/${playerId}/correct`]: correct,
        [`rooms/${state.code}/answers/${room.questionIndex}/${playerId}/points`]: points,
        [`rooms/${state.code}/answers/${room.questionIndex}/${playerId}/scoredAt`]: scoredAt,
      });
      state.scoredAnswers.add(key);
    } catch (scoringError) {
      console.error('Could not score answer', scoringError);
    } finally {
      state.processingAnswers.delete(key);
    }
  }
}

function renderRoom() {
  const room = state.room;

  if (room.status === 'lobby') {
    show('lobby-section');
    $('host-room-code').textContent = state.code;
    const joinUrl = `${location.origin}${location.pathname.replace('host.html', '')}?room=${state.code}`;
    $('join-url').textContent = joinUrl;
    $('join-link').href = `./?room=${state.code}`;
    renderQr(joinUrl);
    return;
  }

  if (room.status === 'finished') {
    stopTimer();
    show('finish-section');
    renderLeaderboard($('final-host-board'), state.players, '', 20);
    return;
  }

  show('game-section');
  const question = QUESTION_BY_ID[room.questionIds?.[room.questionIndex]];
  if (!question) return;

  $('host-question-number').textContent = `Question ${room.questionIndex + 1} of ${room.questionIds.length}`;
  $('host-category').textContent = question.category;
  $('host-question').textContent = question.question;
  $('host-answer-list').innerHTML = '';

  question.answers.forEach((answer, index) => {
    const div = document.createElement('div');
    div.className = `answer ${room.phase === 'reveal' && index === question.correct ? 'correct' : ''}`;
    div.innerHTML = `<span class="letter">${letters[index]}</span><span></span>`;
    div.querySelector('span:last-child').textContent = answer;
    $('host-answer-list').appendChild(div);
  });

  $('host-explanation').classList.toggle('hidden', room.phase !== 'reveal');
  $('host-explanation').textContent = question.explanation;
  $('reveal-button').classList.toggle('hidden', room.phase !== 'question');
  $('leaderboard-button').classList.toggle('hidden', room.phase !== 'reveal');
  $('next-button').classList.toggle('hidden', room.phase !== 'leaderboard');
  $('finish-button').classList.toggle('hidden', room.phase !== 'leaderboard' || room.questionIndex < room.questionIds.length - 1);
  $('next-button').textContent = room.questionIndex >= room.questionIds.length - 1 ? 'Finish game' : 'Next question';

  if (room.phase === 'question') startTimer(room);
  else stopTimer();
  renderResponses();
}

function renderPlayers() {
  const count = Object.keys(state.players).length;
  $('lobby-player-count').textContent = `${count} player${count === 1 ? '' : 's'} joined`;
  $('game-player-count').textContent = count;
  $('player-list').innerHTML = '';

  sortedPlayers(state.players).forEach((player) => {
    const item = document.createElement('div');
    item.className = 'player-chip';
    item.innerHTML = '<span></span><span></span>';
    item.children[0].textContent = player.nickname;
    item.children[1].textContent = `${player.score || 0} pts`;
    $('player-list').appendChild(item);
  });
  renderLeaderboard($('host-board'), state.players, '', 10);
}

function renderResponses() {
  if (!state.room || state.room.questionIndex < 0) return;
  const question = QUESTION_BY_ID[state.room.questionIds[state.room.questionIndex]];
  if (!question) return;

  const values = Object.values(state.answers?.[state.room.questionIndex] || {});
  $('response-count').textContent = values.length;
  $('response-total').textContent = Object.keys(state.players).length;

  const counts = question.answers.map((_, index) => values.filter((answer) => answer.choice === index).length);
  const max = Math.max(1, ...counts);
  $('response-list').innerHTML = '';

  counts.forEach((count, index) => {
    const row = document.createElement('div');
    row.innerHTML = `<div class="status"><span>${letters[index]}. ${question.answers[index]}</span><strong>${count}</strong></div><div class="response-track"><div class="response-fill" style="width:${(count / max) * 100}%"></div></div>`;
    $('response-list').appendChild(row);
  });
}

function renderQr(url) {
  const target = $('qr-target');
  target.innerHTML = '';
  if (window.QRCode) {
    new window.QRCode(target, {
      text: url,
      width: 240,
      height: 240,
      correctLevel: window.QRCode.CorrectLevel.M,
    });
  }
}

async function startGame() {
  if (Object.keys(state.players).length === 0 && !confirm('No players have joined yet. Start anyway?')) return;
  await updateValue(`rooms/${state.code}`, {
    status: 'active',
    phase: 'question',
    questionIndex: 0,
    questionStartedAt: serverNow(),
  });
}

const reveal = () => updateValue(`rooms/${state.code}`, { phase: 'reveal', revealedAt: serverNow() });
const board = () => updateValue(`rooms/${state.code}`, { phase: 'leaderboard' });

async function next() {
  if (state.room.questionIndex >= state.room.questionIds.length - 1) return finish();
  await updateValue(`rooms/${state.code}`, {
    phase: 'question',
    questionIndex: state.room.questionIndex + 1,
    questionStartedAt: serverNow(),
  });
}

const finish = () => updateValue(`rooms/${state.code}`, {
  status: 'finished',
  phase: 'finished',
  finishedAt: serverNow(),
});

function startTimer(room) {
  stopTimer();
  const tick = async () => {
    const duration = (room.durationSeconds || 20) * 1000;
    const remaining = Math.max(0, duration - (serverNow() - (room.questionStartedAt || serverNow())));
    $('host-timer').textContent = `${Math.ceil(remaining / 1000)}s`;
    $('host-timer-bar').style.width = `${(remaining / duration) * 100}%`;
    if (remaining <= 0 && state.room?.phase === 'question') {
      stopTimer();
      await reveal();
    }
  };
  tick();
  state.timer = setInterval(tick, 200);
}

function stopTimer() {
  if (state.timer) clearInterval(state.timer);
  state.timer = null;
}

$('create-room-button').addEventListener('click', createRoom);
$('start-button').addEventListener('click', startGame);
$('reveal-button').addEventListener('click', reveal);
$('leaderboard-button').addEventListener('click', board);
$('next-button').addEventListener('click', next);
$('finish-button').addEventListener('click', finish);

await ready();
mode();
const requested = new URLSearchParams(location.search).get('room')?.toUpperCase();
if (requested && await getValue(`rooms/${requested}`)) {
  state.code = requested;
  listen();
} else {
  show('setup-section');
}
