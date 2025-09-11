// script.js -- external script (ES module)
const lessonSelect = document.getElementById('lessonSelect');
const startBtn = document.getElementById('startBtn');
const quizArea = document.getElementById('quizArea');
const questionText = document.getElementById('questionText');
const answersForm = document.getElementById('answersForm');
const qIndexEl = document.getElementById('qIndex');
const qTotalEl = document.getElementById('qTotal');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const submitBtn = document.getElementById('submitBtn');
const resultArea = document.getElementById('resultArea');
const scoreSummary = document.getElementById('scoreSummary');
const detailedResults = document.getElementById('detailedResults');
const retryBtn = document.getElementById('retryBtn');
const backBtn = document.getElementById('backBtn');
const shuffleAnswersCheckbox = document.getElementById('shuffleAnswers');
const randomTfCheckbox = document.getElementById('randomTf');

let allData = null;
let questions = [];
let currentIndex = 0;
let answersGiven = []; // store user's answers
let sessionOrder = []; // indices order

// utility
const $ = sel => document.querySelector(sel);
const shuffle = arr => {
  // Fisher-Yates
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// load questions.json
async function loadJSON(){
  try{
    const res = await fetch('data/questions.json');
    allData = await res.json();
    populateLessonSelect();
  }catch(e){
    console.error('Failed to load questions.json:', e);
    alert('Failed to load questions data. Make sure data/questions.json exists.');
  }
}

function populateLessonSelect(){
  const lessons = Object.keys(allData.lessons);
  lessons.forEach(key => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = key;
    lessonSelect.appendChild(opt);
  });
}

// convert TF to MCQ optionally
function normalizeQuestion(q, shuffleChoices = true, randomTfToMcq = true){
  if(q.type === 'tf' && randomTfToMcq){
    // Represent as MCQ with True/False choices
    const correct = q.answer === true || q.answer === 'true';
    const choices = ['True','False'];
    const answerIndex = correct ? 0 : 1;
    return { type:'mcq', question: q.question, choices, answer: answerIndex, raw: q };
  } else {
    return {...q};
  }
}

function startQuiz(){
  const lessonKey = lessonSelect.value;
  if(!lessonKey) return alert('Please select a lesson.');

  const rawQuestions = allData.lessons[lessonKey].slice(); // copy
  // map & normalize TF to MCQ if checked, else leave as TF
  const randomTf = randomTfCheckbox.checked;
  const shuffleChoices = shuffleAnswersCheckbox.checked;

  // Prepare question objects, include index reference
  questions = rawQuestions.map((q, i) => {
    const nq = normalizeQuestion(q, shuffleChoices, randomTf);
    // for MCQ, duplicate choices array so we can shuffle without losing original answer mapping
    if(nq.type === 'mcq'){
      const choices = nq.choices.slice();
      const indexed = choices.map((c, idx) => ({c, idx}));
      if(shuffleChoices) shuffle(indexed);
      // map new choices and compute new answer index
      const newChoices = indexed.map(x => x.c);
      const originalAnswerText = nq.choices[nq.answer];
      const newAnswerIndex = newChoices.indexOf(originalAnswerText);
      return {...nq, choices: newChoices, answer: newAnswerIndex, _originalIndex: i};
    } else {
      // tf or id
      return {...nq, _originalIndex: i};
    }
  });

  // randomize order of questions
  sessionOrder = questions.map((_, i) => i);
  shuffle(sessionOrder);

  answersGiven = new Array(questions.length).fill(null);
  currentIndex = 0;
  qTotalEl.textContent = questions.length;
  showQuestion();
  quizArea.classList.remove('hidden');
  resultArea.classList.add('hidden');
  window.scrollTo({top:0,behavior:'smooth'});
}

function showQuestion(){
  const qPos = sessionOrder[currentIndex];
  const q = questions[qPos];
  qIndexEl.textContent = currentIndex + 1;

  // animation
  const card = document.getElementById('questionCard');
  card.classList.remove('animated');
  void card.offsetWidth;
  card.classList.add('animated');

  // render
  questionText.textContent = q.question;
  answersForm.innerHTML = '';

  if(q.type === 'mcq'){
    q.choices.forEach((choice, idx) => {
      const id = `opt_${currentIndex}_${idx}`;
      const label = document.createElement('label');
      label.className = 'answer';
      label.innerHTML = `
        <input type="radio" name="choice" value="${idx}" id="${id}">
        <div class="label-text">${choice}</div>
      `;
      answersForm.appendChild(label);
      // restore previous
      if(answersGiven[currentIndex] !== null && parseInt(answersGiven[currentIndex]) === idx){
        label.querySelector('input').checked = true;
      }
    });
  } else if(q.type === 'tf'){
    // unlikely because normalize may have converted tf to mcq; but keep fallback
    ['True','False'].forEach((choice, idx) => {
      const id = `opt_${currentIndex}_${idx}`;
      const label = document.createElement('label');
      label.className = 'answer';
      label.innerHTML = `
        <input type="radio" name="choice" value="${idx}" id="${id}">
        <div class="label-text">${choice}</div>
      `;
      answersForm.appendChild(label);
      if(answersGiven[currentIndex] !== null && parseInt(answersGiven[currentIndex]) === idx){
        label.querySelector('input').checked = true;
      }
    });
  } else if(q.type === 'id'){
    const label = document.createElement('label');
    label.className = 'answer';
    label.innerHTML = `<input type="text" id="idAnswer" placeholder="Type your answer...">`;
    answersForm.appendChild(label);
    if(answersGiven[currentIndex] !== null){
      label.querySelector('input').value = answersGiven[currentIndex];
    }
  }

  // update nav buttons
  prevBtn.disabled = currentIndex === 0;
  nextBtn.disabled = currentIndex === questions.length - 1;
}

function saveCurrentAnswer(){
  const qPos = sessionOrder[currentIndex];
  const q = questions[qPos];
  if(q.type === 'mcq' || q.type === 'tf'){
    const sel = answersForm.querySelector('input[name="choice"]:checked');
    if(sel) answersGiven[currentIndex] = sel.value;
  } else if(q.type === 'id'){
    const txt = answersForm.querySelector('input[type="text"]').value.trim();
    answersGiven[currentIndex] = txt;
  }
}

function goNext(){
  saveCurrentAnswer();
  if(currentIndex < questions.length - 1){
    currentIndex++;
    showQuestion();
  }
}
function goPrev(){
  saveCurrentAnswer();
  if(currentIndex > 0){
    currentIndex--;
    showQuestion();
  }
}

function evaluate(){
  saveCurrentAnswer();
  const total = questions.length;
  let correctCount = 0;
  const details = [];

  for(let i=0;i<questions.length;i++){
    const qPos = sessionOrder[i];
    const q = questions[qPos];
    const user = answersGiven[i];
    let correct = false;
    let userDisplay = null;
    let correctDisplay = null;

    if(q.type === 'mcq' || q.type === 'tf'){
      if(user === null){ userDisplay = '(no answer)'; }
      else { userDisplay = q.choices[parseInt(user)]; }
      correctDisplay = q.choices[q.answer];

      if(user !== null && parseInt(user) === q.answer) correct = true;
    } else if(q.type === 'id'){
      userDisplay = user === null || user === '' ? '(no answer)' : user;
      correctDisplay = q.answer;
      if(user !== null){
        // case-insensitive comparison, ignore extra spaces
        if(String(user).trim().toLowerCase() === String(q.answer).trim().toLowerCase()) correct = true;
      }
    }

    if(correct) correctCount++;
    details.push({
      index:i+1, question:q.question, type:q.type,
      correct, user:userDisplay, correctAnswer: correctDisplay
    });
  }

  // show results
  quizArea.classList.add('hidden');
  resultArea.classList.remove('hidden');

  const pct = Math.round((correctCount / total) * 100);
  scoreSummary.innerHTML = `<div><strong>${correctCount} / ${total}</strong> correct — ${pct}%</div>`;

  detailedResults.innerHTML = '';
  details.forEach(d => {
    const el = document.createElement('div');
    el.className = 'result-item';
    el.innerHTML = `
      <div class="meta">Q ${d.index} — ${d.type.toUpperCase()} • ${d.correct ? '<span class="correct">Correct</span>' : '<span class="wrong">Wrong</span>'}</div>
      <div class="q">${d.question}</div>
      <div style="margin-top:8px">
        <div><strong>Your answer:</strong> <span>${escapeHtml(d.user)}</span></div>
        ${d.correct ? '' : `<div><strong>Correct answer:</strong> <span>${escapeHtml(d.correctAnswer)}</span></div>`}
      </div>
    `;
    detailedResults.appendChild(el);
  });

  window.scrollTo({top:0,behavior:'smooth'});
}

function escapeHtml(s){
  if(s == null) return '';
  return String(s).replace(/[&<>"']/g, function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]; });
}

// retry/back handlers
function retry(){
  // reshuffle order and optionally reshuffle choices
  // reapply chosen shuffle options
  const shuffleChoices = shuffleAnswersCheckbox.checked;
  const randomTf = randomTfCheckbox.checked;
  // reconstruct questions from allData for selected lesson
  const lessonKey = lessonSelect.value;
  const rawQuestions = allData.lessons[lessonKey].slice();
  questions = rawQuestions.map((q, i) => {
    const nq = normalizeQuestion(q, shuffleChoices, randomTf);
    if(nq.type === 'mcq'){
      const choices = nq.choices.slice();
      const indexed = choices.map((c, idx) => ({c, idx}));
      if(shuffleChoices) shuffle(indexed);
      const newChoices = indexed.map(x => x.c);
      const originalAnswerText = nq.choices[nq.answer];
      const newAnswerIndex = newChoices.indexOf(originalAnswerText);
      return {...nq, choices: newChoices, answer: newAnswerIndex, _originalIndex: i};
    } else {
      return {...nq, _originalIndex: i};
    }
  });
  sessionOrder = questions.map((_, i) => i);
  shuffle(sessionOrder);
  answersGiven = new Array(questions.length).fill(null);
  currentIndex = 0;
  qTotalEl.textContent = questions.length;
  showQuestion();
  quizArea.classList.remove('hidden');
  resultArea.classList.add('hidden');
}

function backToLessons(){
  resultArea.classList.add('hidden');
  quizArea.classList.add('hidden');
  // let user select another lesson
  window.scrollTo({top:0,behavior:'smooth'});
}

// events
startBtn.addEventListener('click', startQuiz);
nextBtn.addEventListener('click', goNext);
prevBtn.addEventListener('click', goPrev);
submitBtn.addEventListener('click', () => {
  if(!confirm('Submit quiz and view results?')) return;
  evaluate();
});
retryBtn.addEventListener('click', retry);
backBtn.addEventListener('click', backToLessons);
window.addEventListener('beforeunload', ()=>{/* no-op */});

// answer saving on change
answersForm.addEventListener('change', (e)=>{
  // auto save radio selections immediately
  const sel = answersForm.querySelector('input[name="choice"]:checked');
  if(sel) answersGiven[currentIndex] = sel.value;
});

if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("service-worker.js")
        .then(() => console.log("Service Worker registered"))
        .catch(err => console.error("Service Worker error", err));
    }

// initial load
loadJSON();


