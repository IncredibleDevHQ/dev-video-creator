import { animateBrandStory } from './brand-story-timeline'
import { storyPresenter } from './story-presenter'
import { animateRollingHeadline } from './rolling-headline'

export const controlIcon = (playing: boolean) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${playing ? '<path d="M8 5v14M16 5v14"/>' : '<path d="m8 5 11 7-11 7Z"/>'}</svg>`

const attentionDiagram =
  () => `<svg class="story-network" viewBox="0 0 620 220" fill="none">
<g class="network-wires" stroke="#608774" stroke-width="1.5">
<path d="M112 46H143V110H173M112 110H173M112 174H143V110"/>
<path d="M199 110H229V46H263M229 110H263M229 110V174H263"/>
<path d="M309 46H337V92H375M309 110H375"/>
<path d="M443 110H515M309 174H480V126H515"/>
</g>
<g class="network-token"><rect x="10" y="27" width="102" height="38" rx="9"/><text x="61" y="51">The</text></g>
<g class="network-token"><rect x="10" y="91" width="102" height="38" rx="9"/><text x="61" y="115">robot</text></g>
<g class="network-token"><rect x="10" y="155" width="102" height="38" rx="9"/><text x="61" y="179">learns</text></g>
<g class="network-embedding"><rect x="173" y="79" width="26" height="62" rx="5"/>
<path d="M180 91H192M180 101H188M180 111H193M180 121H186M180 131H191" stroke="#a8dbba" stroke-width="2"/></g>
<g class="network-projection"><rect x="263" y="27" width="46" height="38" rx="8"/><text x="286" y="51">Q</text></g>
<g class="network-projection"><rect x="263" y="91" width="46" height="38" rx="8"/><text x="286" y="115">K</text></g>
<g class="network-projection"><rect x="263" y="155" width="46" height="38" rx="8"/><text x="286" y="179">V</text></g>
<g class="network-matrix">${Array.from({ length: 9 }, (_, i) => `<rect x="${375 + (i % 3) * 23}" y="${76 + Math.floor(i / 3) * 23}" width="18" height="18" rx="4" fill="${['#5c9e7e', '#bcf198', '#36674f', '#87cba1', '#376f53', '#68a985', '#33664e', '#78b38c', '#c9ef9c'][i]}"/>`).join('')}</g>
<g class="network-context"><rect x="515" y="80" width="94" height="64" rx="12"/><text x="562" y="107">Context</text><text x="562" y="126" class="network-small">vectors</text></g>
<g class="network-labels"><text x="61" y="218">Tokens</text><text x="186" y="218">Embeddings</text><text x="407" y="166">Attention weights</text><text x="407" y="186" class="network-formula">softmax(QKᵀ / √dₖ)</text></g>
<circle class="network-signal signal-query" r="4" fill="#dcffab"/>
<circle class="network-signal signal-value" r="4" fill="#99e5ca"/>
</svg>`

/** An authored product illustration, independent of notebook or model output. */
export const brandStory =
  () => `<section class="brand-story" aria-label="From notes to a story you can tell">
<div class="story-film" role="group" aria-label="See how Incredible works">
<div class="story-grid" aria-hidden="true"></div>
<div class="story-viewport"><div class="story-scene" role="img" aria-label="An illustrative four-step walkthrough: paste notes or a blog link, shape the ideas as wireframes, let AI turn the wireframes into a motion graphics video, then share your ideas on camera by narrating or using a clone of your own voice. An animated character illustrates the presenter.">
<div class="story-composition" aria-hidden="true">
<div class="story-board">
<div class="story-board-bar">
<span class="story-stage-label stage-notes"><b>1</b> Paste notes or a blog link</span><span class="story-stage-label stage-slides"><b>2</b> Shape your scenes as wireframes</span>
<span class="story-stage-label stage-video"><b>3</b>AI turns your wireframes into a beautiful motion graphics video.</span>
<span class="story-stage-label stage-presenter"><b>4</b><span class="story-step-promise">Your incredible ideas. Shared by you.<small>Be in the picture. Narrate or use a clone of your own voice.</small></span></span>
<span class="story-file">attention.md</span></div>
<div class="story-paste"><span class="story-paste-icon">↳</span><strong>Paste your notes or blog link</strong><span class="story-paste-shortcut">⌘ V</span><i class="story-pointer">↖</i></div>
<div class="story-content"><strong class="story-title">How attention<br>finds meaning.</strong>
<div class="story-notes"><p>A transformer connects each word to its context.</p><div><span>01</span> Turn words into token embeddings</div><div><span>02</span> Compare queries and keys</div><div><span>03</span> Mix values using attention weights</div></div>
<div class="story-diagram">${attentionDiagram()}</div>
<div class="story-motion-note"><i></i><span class="motion-note-query">Find the connections</span><span class="motion-note-value">Give each word context</span></div>
</div>
<div class="story-slide-footer"><span>INSIDE A TRANSFORMER</span><span>01 — 03</span></div>
</div>
<div class="story-deck"><span class="story-mini-slide"><i></i><i></i><i></i></span><span><b>02</b> Multi-head attention</span><span><b>03</b> The transformer block</span></div>
<div class="story-person">${storyPresenter()}<span class="story-camera-label"><i></i> YOU, IN THE PICTURE</span><div class="story-wave">${Array.from({ length: 17 }, (_, i) => `<i style="height:${[8, 15, 26, 17, 34, 22, 12, 29, 19, 36, 14, 25, 10, 30, 20, 13, 6][i]}px"></i>`).join('')}</div></div>
<div class="story-narration"><span class="story-voice-heading">YOUR VOICE, YOUR WAY</span><div class="story-voice-options"><span>Talk over it</span><small>or</small><span>Clone your voice</span></div></div>
<div class="story-playback"><svg viewBox="0 0 12 12"><path d="m3 1 8 5-8 5Z" fill="currentColor"/></svg><div><i></i></div><span class="playback-motion">AI MOTION GRAPHICS</span><span class="playback-voice">YOUR IDEAS. YOUR VOICE.</span></div>
</div></div></div>
<div class="story-controls"><span>Notes. Wireframes. Motion. You.</span><div class="story-progress" aria-hidden="true"><i></i><i></i><i></i><i></i></div><button class="story-motion" type="button" data-story-motion aria-label="Pause animation" title="Pause animation">${controlIcon(true)}</button></div>
</div></section>`

/** With notebooks there is no story, and the headline rolls on its own;
 * hidden, it pauses. */
const rollAlone = (headline: HTMLElement) => {
  const motion = animateRollingHeadline(headline)
  const visibility = () => motion.pause(document.hidden)
  document.addEventListener('visibilitychange', visibility)
  return () => {
    document.removeEventListener('visibilitychange', visibility)
    motion.dispose()
  }
}

export const installBrandStory = (root: HTMLElement) => {
  let mounted: HTMLElement | null = null
  let dispose: (() => void) | undefined
  const mount = () => {
    const story = root.querySelector<HTMLElement>('.brand-story')
    const target =
      story || root.querySelector<HTMLElement>('.start .rolling-headline')
    if (target === mounted) return
    dispose?.()
    mounted = target
    dispose = story
      ? animateBrandStory(story, controlIcon)
      : target
        ? rollAlone(target)
        : undefined
  }
  // Start/stop with the home screen; never leave a timeline running after navigation.
  new MutationObserver(mount).observe(root, { childList: true, subtree: true })
  mount()
}
