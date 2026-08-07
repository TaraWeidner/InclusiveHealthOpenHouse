import { QUESTION_BANK, QUESTION_BY_ID } from './questions.js?v=20260807-1';
import {
  backendMode,
  currentUserId,
  getValue,
  ready,
  serverNow,
  setValue,
  subscribe,
} from './store.js';
import {
  $,
  cleanCode,
  cleanNickname,
  confetti,
  letters,
  makePlayerId,
  renderLeaderboard,
  sortedPlayers,
  validNickname,
} from './common.js';

const state = {
  code: '',
  playerId: makePlayerId(),
  nickname: '',
  room: null,
  players: {},
  currentQuestionId: '',
  selected: null,
  timer: null,
  unsubRoom: null,
  unsubPlayers: null,
};

const screens = ['join-screen', 'waiting-screen', 'question-screen', 'leaderboard-screen', 'finished-screen'];
const show = (id) => screens.forEach((screen) => $(screen).classList.toggle('hidden', screen !== id));
const error = (message) => {
  $('join-error').textContent = message;
  $('join-error').classList.remove('hidden');
};

function mode() {
  if (backendMode === 'demo') {
    $('mode-banner').classList.remove('hidden');
    $('mode-banner').innerHTML = '<strong>Demo mode:</strong> open the host page in another tab on this browser to test synchronization. Add Firebase settings for live phones.';
  }
}

async function join() {
  $('join-error').classList.add('hidden');
  const code = cleanCode($('room-code-input').value);
  const nickname = cleanNickname($('nickname').value);

  if (code.length !== 6) return error('Enter the six-character room code shown by the host.');
  if (!validNickname(nickname)) return error('Use a nickname or initials with 2–18 letters, numbers, spaces, dashes, or underscores.');

  const room = await getValue(`rooms/${code}`);
  if (!room) return error('That room could not be found. Check the code and try again.');
  if (room.status !== 'lobby') return error('That game has already started or finished.');

  state.code = code;
  state.nickname = nickname;
  await setValue(`rooms/${code}/players/${state.playerId}`, {
    nickname,
    score: 0,
    correct: 0,
    answered: 0,
    joinedAt: serverNow(),
    lastSeen: serverNow(),
  });

  sessionStorage.setItem('ihTriviaRoom', code);
  sessionStorage.setItem('ihTriviaNickname', nickname);
  listen();
}

function listen() {
  state.unsubRoom?.();
  state.unsubPlayers?.();
  state.unsubRoom = subscribe(`rooms/${state.code}`, (room) => {
    if (!room) return;
    state.room = room;
    renderRoom();
  });
  state.unsubPlayers = subscribe(`rooms/${state.code}/players`, (players) => {
    state.players = players || {};
    const count = Object.keys(state.players).length;
    $('waiting-count').textContent = `${count} player${count === 1 ? '' : 's'} joined`;
    renderLeaderboard($('mid-board'), state.players, state.playerId, 10);
    renderLeaderboard($('final-board'), state.players, state.playerId, 10);
    const rank = sortedPlayers(state.players).findIndex((player) => player.id === state.playerId) + 1;
    if (rank) $('final-rank').textContent = `You placed #${rank} out of ${count} players.`;
  });
}

function renderRoom() {
  const room = state.room;
  const player = room.players?.[state.playerId] || state.players[state.playerId] || {};
  $('waiting-code').textContent = state.code;
  $('score-chip').textContent = `Score: ${player.score || 0}`;
  $('final-score').textContent = `${player.score || 0}`;

  if (room.status === 'lobby') {
    show('waiting-screen');
    return;
  }
  if (room.status === 'finished') {
    stopTimer();
    show('finished-screen');
    if (!sessionStorage.getItem(`celebrated-${state.code}`)) {
      confetti();
      sessionStorage.setItem(`celebrated-${state.code}`, '1');
    }
    return;
  }
  if (room.phase === 'leaderboard') {
    stopTimer();
    show('leaderboard-screen');
    $('leaderboard-progress').textContent = `After question ${Math.min((room.questionIndex || 0) + 1, room.questionIds?.length || 0)}`;
    return;
  }
  if (room.phase === 'question' || room.phase === 'reveal') renderQuestion(room);
}

async function renderQuestion(room) {
  const questionId = room.questionIds?.[room.questionIndex];
  const question = QUESTION_BY_ID[questionId];
  if (!question) return;

  show('question-screen');
  $('question-count').textContent = `Question ${(room.questionIndex || 0) + 1} of ${room.questionIds.length}`;
  $('question-progress').style.width = `${(((room.questionIndex || 0) + 1) / room.questionIds.length) * 100}%`;
  $('question-category').textContent = question.category;
  $('question-text').textContent = question.question;

  if (state.currentQuestionId !== questionId) {
    state.currentQuestionId = questionId;
    state.selected = null;
    const existing = await getValue(`rooms/${state.code}/answers/${room.questionIndex}/${state.playerId}`);
    if (existing) state.selected = existing.choice;
  }

  $('answer-buttons').innerHTML = '';
  question.answers.forEach((answer, index) => {
    const button = document.createElement('button');
    button.className = 'answer';
    button.innerHTML = `<span class="letter">${letters[index]}</span><span></span>`;
    button.querySelector('span:last-child').textContent = answer;
    if (state.selected === index) button.classList.add('selected');

    if (room.phase === 'reveal') {
      button.disabled = true;
      if (index === question.correct) button.classList.add('correct');
      if (state.selected === index && index !== question.correct) button.classList.add('incorrect');
    } else {
      button.disabled = state.selected !== null;
      button.addEventListener('click', () => submit(index));
    }
    $('answer-buttons').appendChild(button);
  });

  if (room.phase === 'reveal') {
    stopTimer();
    const correct = state.selected === question.correct;
    $('feedback').className = 'feedback';
    $('feedback-title').textContent = correct ? 'Correct — nicely done!' : state.selected === null ? 'Time is up!' : 'Good guess!';
    $('feedback-text').textContent = question.explanation;
  } else if (state.selected !== null) {
    $('feedback').className = 'feedback';
    $('feedback-title').textContent = 'Answer locked in!';
    $('feedback-text').textContent = 'Watch the host screen for the reveal.';
    startTimer(room);
  } else {
    $('feedback').className = 'feedback hidden';
    startTimer(room);
  }
}

async function submit(choice) {
  if (!state.room || state.room.phase !== 'question' || state.selected !== null) return;

  const now = serverNow();
  const elapsedMs = Math.max(0, now - (state.room.questionStartedAt || now));
  const path = `rooms/${state.code}/answers/${state.room.questionIndex}/${state.playerId}`;
  if (await getValue(path)) return;

  state.selected = choice;
  try {
    await setValue(path, { choice, elapsedMs, submittedAt: now });
    renderQuestion(state.room);
  } catch (submissionError) {
    console.error(submissionError);
    state.selected = null;
    $('feedback').className = 'feedback';
    $('feedback-title').textContent = 'We could not save that answer.';
    $('feedback-text').textContent = 'Please tap your answer again.';
    renderQuestion(state.room);
  }
}

function startTimer(room) {
  stopTimer();
  const tick = () => {
    const duration = (room.durationSeconds || 20) * 1000;
    const remaining = Math.max(0, duration - (serverNow() - (room.questionStartedAt || serverNow())));
    const percent = Math.max(0, (remaining / duration) * 100);
    $('timer-number').textContent = `${Math.ceil(remaining / 1000)}s`;
    $('timer-bar').style.width = `${percent}%`;
    if (remaining <= 0) stopTimer();
  };
  tick();
  state.timer = setInterval(tick, 200);
}

function stopTimer() {
  if (state.timer) clearInterval(state.timer);
  state.timer = null;
}

$('player-question-bank-count').textContent = QUESTION_BANK.length;
$('join-button').addEventListener('click', join);
$('room-code-input').addEventListener('input', (event) => {
  event.target.value = cleanCode(event.target.value);
});
$('nickname').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') join();
});

await ready();
if (backendMode === 'live') state.playerId = currentUserId();
mode();

const queryCode = cleanCode(new URLSearchParams(location.search).get('room') || '');
if (queryCode) $('room-code-input').value = queryCode;

const savedRoom = cleanCode(sessionStorage.getItem('ihTriviaRoom') || '');
const savedNickname = cleanNickname(sessionStorage.getItem('ihTriviaNickname') || '');
if (savedRoom && savedNickname && await getValue(`rooms/${savedRoom}`)) {
  state.code = savedRoom;
  state.nickname = savedNickname;
  $('nickname').value = savedNickname;
  $('room-code-input').value = savedRoom;
  listen();
}
