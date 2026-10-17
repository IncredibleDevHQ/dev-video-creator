import type { gsap } from 'gsap'

/** An illustrated speaker, animated by the walkthrough's shared playhead. */
export const storyPresenter =
  () => `<svg class="story-presenter" viewBox="0 0 280 280" fill="none" aria-hidden="true">
<defs><linearGradient id="story-avatar-bg" x1="0" y1="0" x2="280" y2="280" gradientUnits="userSpaceOnUse"><stop stop-color="#e9edce"/><stop offset="1" stop-color="#bed6b2"/></linearGradient></defs>
<rect width="280" height="280" rx="16" fill="url(#story-avatar-bg)"/>
<circle cx="247" cy="34" r="89" fill="#f8f5de" opacity=".45"/>
<path d="M0 219C57 165 105 273 280 179V280H0Z" fill="#8caf96" opacity=".35"/>
<g class="presenter-body">
<path d="M54 280L61 231C65 197 101 186 140 186C179 186 215 197 219 231L228 280Z" fill="#c87857"/>
<path d="M119 183H161V210Q141 229 119 210Z" fill="#b87851"/>
<path d="M116 207Q141 225 165 206" stroke="#9d533d" stroke-width="3" stroke-linecap="round"/>
<path d="M92 230L87 280M190 230L198 280" stroke="#a95f47" stroke-width="3" stroke-linecap="round"/>
<path d="M176 242H195" stroke="#eab394" stroke-width="3" stroke-linecap="round"/>
</g>
<g class="presenter-head">
<path d="M79 108C65 37 113 28 142 31C195 26 214 77 199 122L183 160H96Z" fill="#243630"/>
<ellipse cx="87" cy="134" rx="13" ry="18" fill="#c5895d"/>
<ellipse cx="193" cy="134" rx="13" ry="18" fill="#c5895d"/>
<path d="M91 99C91 68 113 58 140 58C170 58 190 75 190 102V143C190 181 164 199 140 199C113 199 90 177 90 143Z" fill="#dda673"/>
<path d="M96 112C103 76 155 98 171 67C178 94 188 101 191 118L195 83L160 48L104 56L82 101Z" fill="#243630"/>
<path d="M101 66Q124 35 159 53" stroke="#40534a" stroke-width="7" stroke-linecap="round"/>
<path d="M105 117Q115 112 125 117M155 117Q166 112 176 117" stroke="#493a2c" stroke-width="3" stroke-linecap="round"/>
<g class="presenter-eye eye-left"><ellipse cx="116" cy="130" rx="8" ry="6" fill="#fff7e9"/><ellipse cx="118" cy="130" rx="3.8" ry="5" fill="#28372f"/><circle cx="119" cy="128" r="1.3" fill="white"/></g>
<g class="presenter-eye eye-right"><ellipse cx="165" cy="130" rx="8" ry="6" fill="#fff7e9"/><ellipse cx="163" cy="130" rx="3.8" ry="5" fill="#28372f"/><circle cx="164" cy="128" r="1.3" fill="white"/></g>
<path d="M139 129L135 149Q139 153 145 149" stroke="#b77d52" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
<ellipse cx="110" cy="153" rx="10" ry="5" fill="#d59169"/>
<ellipse cx="170" cy="153" rx="10" ry="5" fill="#d59169"/>
<g class="presenter-mouth"><rect x="124" y="160" width="33" height="19" rx="9" fill="#673e32"/><path d="M128 160H153V164Q140 168 128 164Z" fill="#fff6df"/><path d="M130 176Q140 168 151 176Q140 183 130 176Z" fill="#d68b7e"/></g>
<path d="M131 187Q140 190 149 187" stroke="#c68c60" stroke-width="2" stroke-linecap="round"/>
</g>
<g class="presenter-hand"><path d="M53 261L41 211Q38 200 46 197Q53 194 57 205L62 220L59 186Q59 177 66 177Q73 177 73 188L77 215L80 196Q81 188 88 190Q94 192 92 201L89 224L99 214Q105 209 109 215Q112 220 106 228L89 253L94 280H59Z" fill="#dda673"/><path d="M60 226Q69 222 77 229" stroke="#b77d52" stroke-width="2.5" stroke-linecap="round"/></g>
</svg>`

/** Authored speaking gestures; every movement obeys the same pause control. */
export const animateStoryPresenter = (
  timeline: gsap.core.Timeline,
  story: HTMLElement
) => {
  const mouth = story.querySelector('.presenter-mouth')!
  const head = story.querySelector('.presenter-head')!
  const eyes = story.querySelectorAll('.presenter-eye')
  const body = story.querySelector('.presenter-body')!
  const hand = story.querySelector('.presenter-hand')!
  timeline
    .set(mouth, { svgOrigin: '140 169', scaleY: 0.18 }, 0)
    .set(head, { svgOrigin: '140 190' }, 0)
    .set(eyes, { transformOrigin: '50% 50%' }, 0)
    .set(body, { svgOrigin: '140 280' }, 0)
    .set(hand, { svgOrigin: '75 265', rotation: -5 }, 0)
    .to(
      body,
      {
        scaleY: 1.015,
        duration: 1.7,
        repeat: 5,
        yoyo: true,
        ease: 'sine.inOut'
      },
      21.4
    )
    .to(head, { rotation: 2, y: 1.5, duration: 1.1, ease: 'sine.inOut' }, 21.3)
    .to(
      head,
      {
        rotation: -2,
        y: -1,
        duration: 1.6,
        repeat: 4,
        yoyo: true,
        ease: 'sine.inOut'
      },
      22.4
    )
    .to(
      hand,
      {
        rotation: 6,
        duration: 0.55,
        repeat: 3,
        yoyo: true,
        ease: 'sine.inOut'
      },
      21
    )
    .to(
      hand,
      {
        rotation: 1,
        y: 5,
        duration: 1.2,
        repeat: 5,
        yoyo: true,
        ease: 'sine.inOut'
      },
      24
    )

  for (const at of [22.7, 26.4, 30.3]) {
    timeline.to(
      eyes,
      {
        scaleY: 0.08,
        duration: 0.09,
        repeat: 1,
        yoyo: true,
        ease: 'power1.inOut'
      },
      at
    )
  }
  // Short, varied syllables with a pause between phrases feel less mechanical.
  for (const at of [21.5, 24, 26.5, 29]) {
    const syllables = [0.75, 0.25, 1, 0.32, 0.68, 0.2, 0.82, 0.15]
    syllables.forEach((scaleY, index) => {
      timeline.to(
        mouth,
        {
          scaleY,
          scaleX: scaleY > 0.7 ? 0.92 : 1,
          duration: 0.19,
          ease: 'sine.inOut'
        },
        at + index * 0.2
      )
    })
  }
}
