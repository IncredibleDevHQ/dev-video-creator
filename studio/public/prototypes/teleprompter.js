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
let editing = false;
let completion = '';
let beforeEditPosition = 0;
let completionDismissed = false;

function icon(name) { return `<svg aria-hidden="true"><use href="#${name}"/></svg>`; }
function time(value, tenths = false) {
  const seconds = Math.max(0, value);
  const ticks = Math.floor(seconds * 10 + 1e-7);
  return `${Math.floor(ticks / 600)}:${String(Math.floor(ticks / 10) % 60).padStart(2, '0')}${tenths ? '.' + ticks % 10 : ''}`;
}
function extraSeconds(text) { return Math.max(2, text.trim().split(/\s+/).length / 2.5); }
function renderTimeline() {
  const visibleAddition = editing ? (draftText() + completion).trim() : addition;
  const extraWords = visibleAddition ? visibleAddition.split(/\s+/) : [];
  total = animationDuration + (visibleAddition ? extraSeconds(visibleAddition) : 0);
  axisDuration = visibleAddition ? total : 8;
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
  $('held-clip').hidden = !visibleAddition;
  $('dialogue-track').replaceChildren();
  const phrases = [
    { start: 0, end: 3 / originalWords.length * 6, text: 'So you point,' },
    { start: 3 / originalWords.length * 6, end: 9 / originalWords.length * 6, text: 'ChatGPT suggests right beside the work,' },
    { start: 9 / originalWords.length * 6, end: 6, text: 'and you make the change, with a way back.' },
  ];
  if (visibleAddition) phrases.push({ start: 6, end: total, text: visibleAddition, extra: true });
  for (const phrase of phrases) {
    const button = document.createElement('button');
    button.className = 'phrase' + (phrase.extra ? ' extra' : '') + (editing && phrase.extra ? ' draft-clip' : '');
    button.disabled = editing;
    button.dataset.start = String(phrase.start); button.dataset.end = String(phrase.end);
    button.style.left = `${phrase.start / axisDuration * 100}%`;
    button.style.width = `calc(${(phrase.end - phrase.start) / axisDuration * 100}% - 4px)`;
    button.title = `${time(phrase.start, true)} · ${phrase.text}`;
    button.setAttribute('aria-label', `Jump to ${phrase.text}`);
    const label = document.createElement('span'); label.textContent = phrase.text; button.append(label);
    button.onclick = () => seek(phrase.start);
    $('dialogue-track').append(button);
  }
  if (!visibleAddition && !editing) {
    const add = document.createElement('button'); add.className = 'add-clip';
    add.innerHTML = `${icon('plus')}<span>Keep talking</span>`;
    add.onclick = openAddition; $('dialogue-track').append(add);
  }
  $('edit-addition').hidden = !addition || editing;
  words = originalWords.map((word, index) => ({ word, start: index / originalWords.length * 6, extra: false }));
  words.push(...extraWords.map((word, index) => ({ word, start: 6 + index / extraWords.length * (total - 6), extra: true })));
  if (editing) { paint(); return; }
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
  const extending = (Boolean(addition) || editing) && position >= 6;
  $('hold-badge').hidden = !extending;
  $('reading-mode').innerHTML = `<span class="sync-dot"${extending ? ' style="background:var(--amber)"' : ''}></span>${extending ? 'Keep talking' : 'Read along'}`;
  $('pacing-label').textContent = editing ? 'Animation holds after 0:06' : 'Planned timing';
  $('play-status').textContent = extending ? 'Animation held · extra dialogue' : position >= 5.98 ? 'Animation finished' : playing ? `${(6 - position).toFixed(1)}s of animation left` : 'Watch the animation. Read along.';
  $('toggle-play').innerHTML = `${icon(playing ? 'pause' : 'play')}<span>${playing ? 'Pause' : position >= total - .02 ? 'Replay' : 'Play'}</span>`;
  $('toggle-play').setAttribute('aria-label', playing ? 'Pause preview' : position >= total - .02 ? 'Replay preview' : 'Play preview');
  document.querySelectorAll('.phrase').forEach(phrase => {
    phrase.classList.toggle('is-active', position >= Number(phrase.dataset.start) && (position < Number(phrase.dataset.end) || position === total && Number(phrase.dataset.end) === total));
  });
  if (editing) return;
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
  if (!ready || editing) return;
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
  if (editing) return;
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
    ready = true; setPlaybackEnabled();
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
  if (event.code === 'Space' && !editing && !document.activeElement.isContentEditable && !['BUTTON', 'TEXTAREA', 'INPUT'].includes(document.activeElement.tagName)) {
    event.preventDefault(); playing ? pause() : void play();
  }
});

function setPlaybackEnabled() {
  for (const id of ['toggle-play', 'replay', 'seek', 'animation-clip']) $(id).disabled = !ready || editing;
}
function draftText() { return $('extra-dialogue').innerText.replace(/\u00a0/g, ' '); }

// Deliberately local sample completions, labeled in the UI. No AI request is made.
// Changing the length only changes the unaccepted suffix; typed text is never rewritten.
function sampleCompletion(text, seconds) {
  const prefix = text.trim().replace(/\s+/g, ' ');
  const starters = [
    'For example, pick one sentence and ask ChatGPT to make it clearer.',
    'Try choosing one sentence and asking ChatGPT to make it clearer.',
    'You can start with one sentence and ask for a clearer version.',
  ];
  const first = starters.find(sentence => sentence.toLowerCase().startsWith(prefix.toLowerCase())) || starters[0];
  const sentences = [first,
    'Compare the suggestion with your original, and keep what sounds like you.',
    'You can always go back, so it is easy to try something different.',
    'Start small, then use the same approach to improve the rest of your draft.',
    'The goal is to make the work feel more like yours, with a little help along the way.',
  ];
  const wholeSample = sentences.join(' ');
  const matches = wholeSample.toLowerCase().startsWith(prefix.toLowerCase());
  const budget = seconds * 2.5;
  if (!matches && prefix.split(/\s+/).length >= budget) return '';
  let candidate = '';
  for (const sentence of sentences) {
    const next = (candidate + ' ' + sentence).trim();
    const prefixWords = matches ? 0 : prefix.split(/\s+/).filter(Boolean).length;
    const nextSize = next.split(/\s+/).length + prefixWords;
    const currentSize = candidate ? candidate.split(/\s+/).length + prefixWords : 0;
    if (candidate && candidate.length >= (matches ? prefix.length : 0) && Math.abs(currentSize - budget) <= Math.abs(nextSize - budget)) break;
    candidate = next;
  }
  if (matches) {
    let suffix = candidate.slice(prefix.length);
    if (/\s$/.test(text)) suffix = suffix.trimStart();
    return suffix;
  }
  const separator = /[.!?]\s*$/.test(text) ? (/\s$/.test(text) ? '' : ' ') : '. ';
  return separator + candidate;
}
function focusDraftEnd() {
  const field = $('extra-dialogue'); field.focus({ preventScroll: true });
  const range = document.createRange(); range.selectNodeContents(field); range.collapse(false);
  const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
  const caret = range.getBoundingClientRect();
  const line = caret.height ? caret : field.getBoundingClientRect(); const window = $('writing-window');
  if (line.height) window.scrollTop += line.top - window.getBoundingClientRect().top - 22;
}
function caretAtEnd() {
  const selection = getSelection();
  if (!selection?.isCollapsed || !selection.rangeCount || !$('extra-dialogue').contains(selection.anchorNode)) return false;
  const tail = selection.getRangeAt(0).cloneRange();
  tail.selectNodeContents($('extra-dialogue')); tail.setStart(selection.anchorNode, selection.anchorOffset);
  return tail.toString().length === 0;
}
function updateDraft() {
  const typed = draftText();
  const minimum = Math.max(5, Math.ceil((typed.trim() ? extraSeconds(typed) : 0) / 5) * 5);
  const slider = $('extension-length');
  slider.max = String(Math.max(30, minimum + 10)); slider.min = String(minimum);
  if (Number(slider.value) < minimum) slider.value = String(minimum);
  completion = completionDismissed ? '' : sampleCompletion(typed, Number(slider.value));
  $('completion').textContent = completion;
  $('extension-target').textContent = `~${slider.value}s`;
  slider.setAttribute('aria-valuetext', `About ${slider.value} extra seconds`);
  $('use-completion').disabled = !completion;
  $('keep-extension').disabled = !(typed + completion).trim();
  renderTimeline();
}
function openAddition() {
  if (editing) return;
  pause(); beforeEditPosition = position; seek(6);
  editing = true; completionDismissed = Boolean(addition);
  $('extra-dialogue').textContent = addition;
  $('completion-status').textContent = '';
  $('original-context').textContent = original;
  $('extension-length').min = '5'; $('extension-length').max = String(Math.max(30, addition ? Math.ceil(extraSeconds(addition) / 5) * 5 + 10 : 30));
  $('extension-length').value = String(addition ? Math.ceil(extraSeconds(addition) / 5) * 5 : 10);
  $('reading-window').hidden = true; $('inline-editor').hidden = false;
  document.querySelector('.prompter').classList.add('is-editing');
  $('hint').textContent = 'Sample completions · type your words or move the slider to explore.';
  setPlaybackEnabled(); updateDraft();
  focusDraftEnd();
  const x = 6 / axisDuration * $('timeline').clientWidth;
  $('timeline-scroll').scrollLeft = Math.max(0, x - $('timeline-scroll').clientWidth * .6);
}
function finishEditing(accept) {
  if (accept) addition = (draftText() + completion).trim();
  editing = false; completion = '';
  $('inline-editor').hidden = true; $('reading-window').hidden = false;
  document.querySelector('.prompter').classList.remove('is-editing');
  setPlaybackEnabled(); renderTimeline(); seek(accept ? 6 : beforeEditPosition);
  $('hint').textContent = accept ? 'Extension added. Press Play to read it with the last frame held.' : 'Click a phrase to jump to that point.';
  if (accept) $('toggle-play').focus();
  else (addition ? $('edit-addition') : document.querySelector('.add-clip')).focus();
}
function acceptCompletion() {
  if (!completion) return;
  $('extra-dialogue').textContent = draftText() + completion;
  completionDismissed = true; updateDraft(); focusDraftEnd();
  $('completion-status').textContent = 'Suggestion accepted. You can keep typing.';
}
$('edit-addition').onclick = openAddition;
$('extra-dialogue').oninput = () => { completionDismissed = false; updateDraft(); };
$('extra-dialogue').onkeydown = event => {
  if (event.isComposing) return;
  if (event.key === 'Tab' && !event.shiftKey && completion && caretAtEnd()) { event.preventDefault(); acceptCompletion(); }
  if (event.key === 'Escape') {
    event.preventDefault(); completionDismissed = true; updateDraft();
    $('completion-status').textContent = 'Suggestion dismissed.';
  }
};
$('extension-length').oninput = () => { completionDismissed = false; updateDraft(); };
$('use-completion').onclick = acceptCompletion;
$('keep-extension').onclick = () => finishEditing(true);
$('cancel-extension').onclick = () => finishEditing(false);
new ResizeObserver(() => {
  $('timeline').style.width = `${Math.max($('timeline-scroll').clientWidth, axisDuration * 80)}px`;
}).observe($('timeline-scroll'));
if (video.readyState >= 1) loadMoment();
renderTimeline(); requestAnimationFrame(tick);
