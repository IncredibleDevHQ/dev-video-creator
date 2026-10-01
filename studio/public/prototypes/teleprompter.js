const $ = id => document.getElementById(id);
const video = $('animation');
const nativeStart = 33;
const animationDuration = 6;
const lastFrame = 38.92;
const original = 'So you point, ChatGPT suggests right beside the work, and you make the change, with a way back.';
const originalWords = original.split(/\s+/);
let addition = '';
let words = [];
let total = animationDuration;
let axisDuration = 8;
let position = 0;
let playing = false;
let ready = false;
let extraClock = null;
let playbackRequest = 0;
let currentIndex = -1;
let lastFollowedIndex = -1;
let scrollBackAt = 0;

function icon(name) { return `<svg aria-hidden="true"><use href="#${name}"/></svg>`; }
function time(value, tenths = false) {
  const seconds = Math.max(0, value);
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}${tenths ? '.' + Math.floor((seconds % 1) * 10) : ''}`;
}
function extraSeconds(text) { return Math.max(2, text.trim().split(/\s+/).length / 2.5); }
function renderTimeline() {
  const extraWords = addition ? addition.split(/\s+/) : [];
  total = animationDuration + (addition ? extraSeconds(addition) : 0);
  axisDuration = addition ? total : 8;
  $('total').textContent = time(total, true);
  $('seek').max = String(total);
  $('timeline').style.setProperty('--end', `${animationDuration / axisDuration * 100}%`);
  $('timeline').style.width = `${Math.max($('timeline-scroll').clientWidth, axisDuration * 80)}px`;
  $('ruler').replaceChildren();
  for (let t = 0; t < axisDuration; t += 2) {
    // Leave the animation boundary caption room to breathe.
    if (t >= 6 && t < 8) continue;
    const tick = document.createElement('span'); tick.className = 'tick';
    tick.style.left = `${t / axisDuration * 100}%`; tick.textContent = time(t);
    $('ruler').append(tick);
  }
  $('held-clip').hidden = !addition;
  $('dialogue-track').replaceChildren();
  const phrases = [
    { start: 0, end: 3 / originalWords.length * 6, text: 'So you point,' },
    { start: 3 / originalWords.length * 6, end: 9 / originalWords.length * 6, text: 'ChatGPT suggests right beside the work,' },
    { start: 9 / originalWords.length * 6, end: 6, text: 'and you make the change, with a way back.' },
  ];
  if (addition) phrases.push({ start: 6, end: total, text: addition, extra: true });
  for (const phrase of phrases) {
    const button = document.createElement('button');
    button.className = 'phrase' + (phrase.extra ? ' extra' : '');
    button.dataset.start = String(phrase.start); button.dataset.end = String(phrase.end);
    button.style.left = `${phrase.start / axisDuration * 100}%`;
    button.style.width = `calc(${(phrase.end - phrase.start) / axisDuration * 100}% - 4px)`;
    button.title = `${time(phrase.start, true)} · ${phrase.text}`;
    button.setAttribute('aria-label', `Jump to ${phrase.text}`);
    const label = document.createElement('span'); label.textContent = phrase.text; button.append(label);
    button.onclick = () => seek(phrase.start);
    $('dialogue-track').append(button);
  }
  if (!addition) {
    const add = document.createElement('button'); add.className = 'add-clip';
    add.innerHTML = `${icon('plus')}<span>Keep talking</span>`;
    add.onclick = openAddition; $('dialogue-track').append(add);
  }
  $('edit-addition').hidden = !addition;
  words = originalWords.map((word, index) => ({ word, start: index / originalWords.length * 6, extra: false }));
  words.push(...extraWords.map((word, index) => ({ word, start: 6 + index / extraWords.length * (total - 6), extra: true })));
  $('script').replaceChildren();
  for (const [index, word] of words.entries()) {
    if (index === originalWords.length) {
      const boundary = document.createElement('span'); boundary.className = 'extension-divider';
      boundary.textContent = 'ANIMATION ENDS · KEEP TALKING'; $('script').append(boundary);
    }
    const span = document.createElement('span'); span.className = 'word' + (word.extra ? ' extra' : '');
    span.textContent = word.word; span.dataset.word = String(index);
    $('script').append(span, document.createTextNode(' '));
  }
  currentIndex = -1; lastFollowedIndex = -1; paint();
}

function paint() {
  $('elapsed').textContent = time(position, true);
  $('seek').value = String(position);
  $('playhead').style.left = `${position / axisDuration * 100}%`;
  const extending = Boolean(addition) && position >= 6;
  $('hold-badge').hidden = !extending;
  $('reading-mode').innerHTML = `<span class="sync-dot"${extending ? ' style="background:var(--amber)"' : ''}></span>${extending ? 'Keep talking' : 'Read along'}`;
  $('play-status').textContent = extending ? 'Animation held · extra dialogue' : position >= 5.98 ? 'Animation finished' : playing ? `${(6 - position).toFixed(1)}s of animation left` : 'Watch the animation. Read along.';
  $('toggle-play').innerHTML = `${icon(playing ? 'pause' : 'play')}<span>${playing ? 'Pause' : position >= total - .02 ? 'Replay' : 'Play'}</span>`;
  $('toggle-play').setAttribute('aria-label', playing ? 'Pause preview' : position >= total - .02 ? 'Replay preview' : 'Play preview');
  document.querySelectorAll('.phrase').forEach(phrase => {
    phrase.classList.toggle('is-active', position >= Number(phrase.dataset.start) && (position < Number(phrase.dataset.end) || position === total && Number(phrase.dataset.end) === total));
  });
  let index = words.findLastIndex(word => position >= word.start);
  index = Math.max(0, index);
  if (index !== currentIndex) {
    currentIndex = index;
    document.querySelectorAll('.word').forEach((span, i) => {
      span.classList.toggle('current', i === index); span.classList.toggle('read', i < index);
      if (i === index) span.setAttribute('aria-current', 'true'); else span.removeAttribute('aria-current');
    });
  }
  if (index !== lastFollowedIndex && performance.now() > scrollBackAt) {
    lastFollowedIndex = index;
    const active = $('script').querySelector('.current');
    if (active) {
      const container = $('reading-window');
      const relativeTop = active.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
      container.scrollTo({ top: Math.max(0, relativeTop - 32), behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'instant' : 'smooth' });
    }
  }
  if (playing) {
    const scroller = $('timeline-scroll'); const x = position / axisDuration * $('timeline').clientWidth;
    if (x > scroller.scrollLeft + scroller.clientWidth - 45 || x < scroller.scrollLeft) scroller.scrollLeft = Math.max(0, x - scroller.clientWidth * .35);
  }
}

function pause() {
  if (extraClock !== null) position = Math.min(total, 6 + (performance.now() - extraClock) / 1000);
  else if (playing && !video.seeking) position = Math.max(0, Math.min(6, video.currentTime - nativeStart));
  playing = false; extraClock = null; playbackRequest++; video.pause(); paint();
}
async function play() {
  if (!ready) return;
  if (position >= total - .02) seek(0);
  const request = ++playbackRequest;
  if (position >= 6) {
    extraClock = performance.now() - (position - 6) * 1000; playing = true; paint(); return;
  }
  // A single native player drives the animation, word highlight, and playhead.
  // Do not seek on every timer tick: that repeatedly discards decoded frames.
  if (Math.abs(video.currentTime - (nativeStart + position)) > .12) video.currentTime = nativeStart + position;
  try {
    await video.play();
    if (request !== playbackRequest) return;
    playing = true; extraClock = null; $('media-state').hidden = true; paint();
  } catch {
    playing = false; $('play-status').textContent = 'Playback paused. Press Play to try again.';
  }
}
function seek(value) {
  const resume = playing; pause();
  position = Math.max(0, Math.min(total, value));
  video.currentTime = Math.min(lastFrame, nativeStart + position);
  currentIndex = -1; scrollBackAt = 0; lastFollowedIndex = -1; paint();
  if (resume) void play();
}
function tick() {
  if (playing) {
    if (extraClock !== null) position = Math.min(total, 6 + (performance.now() - extraClock) / 1000);
    else if (!video.seeking) {
      position = Math.max(0, Math.min(6, video.currentTime - nativeStart));
      if (video.currentTime >= lastFrame || video.ended) {
        video.pause(); video.currentTime = lastFrame; position = 6;
        if (addition) extraClock = performance.now();
      }
    }
    if (position >= total) { position = total; playing = false; extraClock = null; video.pause(); }
    paint();
  }
  requestAnimationFrame(tick);
}

function loadMoment() { video.currentTime = nativeStart; }
video.addEventListener('loadedmetadata', loadMoment, { once: true });
video.addEventListener('seeked', () => {
  if (!ready && video.readyState >= 2) {
    ready = true; $('toggle-play').disabled = false; $('replay').disabled = false; $('seek').disabled = false;
  }
  if (video.readyState >= 2) $('media-state').hidden = true;
});
video.addEventListener('error', () => {
  pause(); ready = false; $('media-state').hidden = false;
  $('media-state').textContent = 'Animation unavailable. Reload to try again.';
  $('toggle-play').disabled = true; $('replay').disabled = true; $('seek').disabled = true;
});
$('toggle-play').onclick = () => playing ? pause() : void play();
$('replay').onclick = () => { pause(); seek(0); void play(); };
$('animation-clip').onclick = () => { seek(0); void play(); };
$('seek').oninput = event => seek(Number(event.target.value));
$('reading-window').addEventListener('wheel', () => { scrollBackAt = performance.now() + 2000; lastFollowedIndex = -1; }, { passive: true });
document.addEventListener('keydown', event => {
  if (event.code === 'Space' && !$('addition-dialog').open && !['BUTTON', 'TEXTAREA', 'INPUT'].includes(document.activeElement.tagName)) {
    event.preventDefault(); playing ? pause() : void play();
  }
});

function openAddition() {
  pause();
  $('extra-dialogue').value = addition;
  $('write-view').hidden = false; $('review-view').hidden = true;
  $('review-addition').hidden = false; $('accept-addition').hidden = true; $('edit-draft').hidden = true;
  updateDraft(); $('addition-dialog').showModal(); $('extra-dialogue').focus();
}
function updateDraft() {
  const value = $('extra-dialogue').value.trim();
  $('review-addition').disabled = !value;
  $('extra-duration').textContent = value ? `About ${Math.ceil(extraSeconds(value))} seconds more` : 'Your words, at your pace.';
}
$('edit-addition').onclick = openAddition;
$('close-dialog').onclick = () => $('addition-dialog').close();
$('extra-dialogue').oninput = updateDraft;
$('example').onclick = () => {
  $('extra-dialogue').value = 'Try it with a sentence of your own. Ask for one small improvement, then decide what you want to keep.';
  updateDraft(); $('extra-dialogue').focus();
};
$('review-addition').onclick = () => {
  $('write-view').hidden = true; $('review-view').hidden = false;
  $('review-addition').hidden = true; $('accept-addition').hidden = false; $('edit-draft').hidden = false;
  $('addition-diff').textContent = $('extra-dialogue').value.trim(); $('accept-addition').focus();
};
$('edit-draft').onclick = () => {
  $('write-view').hidden = false; $('review-view').hidden = true;
  $('review-addition').hidden = false; $('accept-addition').hidden = true; $('edit-draft').hidden = true;
  $('extra-dialogue').focus();
};
$('accept-addition').onclick = () => {
  addition = $('extra-dialogue').value.trim();
  $('addition-dialog').close(); renderTimeline(); seek(6);
  $('hint').textContent = 'Extra dialogue added in this prototype. Press Play to try it.';
  $('toggle-play').focus();
};
new ResizeObserver(() => {
  $('timeline').style.width = `${Math.max($('timeline-scroll').clientWidth, axisDuration * 80)}px`;
}).observe($('timeline-scroll'));
if (video.readyState >= 1) loadMoment();
renderTimeline(); requestAnimationFrame(tick);
