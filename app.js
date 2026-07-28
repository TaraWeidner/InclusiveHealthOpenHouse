const screens = {
  join: document.getElementById('join-screen'),
  waiting: document.getElementById('waiting-screen'),
  question: document.getElementById('question-screen'),
  leaderboard: document.getElementById('leaderboard-screen')
};
const playerTab = document.getElementById('player-tab');
const hostTab = document.getElementById('host-tab');
const hostPanel = document.getElementById('host-panel');
const feedback = document.getElementById('feedback');
const answerButtons = [...document.querySelectorAll('.answer-button')];

function showScreen(name) {
  Object.entries(screens).forEach(([key, element]) => {
    element.classList.toggle('hidden', key !== name);
  });
  document.querySelector('.phone').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function setMode(mode) {
  const hostMode = mode === 'host';
  playerTab.classList.toggle('active', !hostMode);
  hostTab.classList.toggle('active', hostMode);
  hostPanel.classList.toggle('hidden', !hostMode);
}

function revealAnswer() {
  showScreen('question');
  feedback.classList.remove('hidden');
  answerButtons.forEach((button, index) => {
    button.disabled = true;
    button.classList.toggle('correct', index === 1);
    if (button.classList.contains('selected') && index !== 1) button.classList.add('incorrect');
  });
}

document.getElementById('join-button').addEventListener('click', () => showScreen('waiting'));
document.getElementById('host-start').addEventListener('click', () => showScreen('question'));
document.getElementById('host-reveal').addEventListener('click', revealAnswer);
document.getElementById('host-board').addEventListener('click', () => showScreen('leaderboard'));

answerButtons.forEach((button) => {
  button.addEventListener('click', () => {
    answerButtons.forEach((item) => item.classList.remove('selected'));
    button.classList.add('selected');
  });
});

playerTab.addEventListener('click', () => setMode('player'));
hostTab.addEventListener('click', () => setMode('host'));

document.getElementById('reset-demo').addEventListener('click', () => {
  showScreen('join');
  setMode('player');
  feedback.classList.add('hidden');
  answerButtons.forEach((button) => {
    button.disabled = false;
    button.classList.remove('selected', 'correct', 'incorrect');
  });
});
