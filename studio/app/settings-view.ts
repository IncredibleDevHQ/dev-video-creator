import { themeControl } from './appearance'
import { html } from './ui'
import incredibleLogo from './assets/incredible-logo.svg'
import type { StudioSettings } from '../shared/settings'
import { CLONE_SCRIPT } from '../shared/settings'
import { voiceValue, voiceChoices } from './voice-choice'
import { escape, button } from './ui'
import type { Recording } from './recording'
export type SettingsPanel = 'voice' | 'branding' | 'keys' | 'agent'
export const settingsScreen = (
  data: StudioSettings | null,
  panel: SettingsPanel,
  capture: Recording,
  busy: boolean,
  projectId: string | null
) => {
  const tab = (id: SettingsPanel, label: string) =>
    html`<button
      data-settings-panel="${id}"
      aria-current="${panel === id ? 'page' : 'false'}"
    >
      ${label}
    </button>`
  return html`<header>
      <a class="brand" href="/" aria-label="Incredible Studio"
        ><img src="${incredibleLogo}" alt="" />Incredible</a
      ><span>Settings</span>
      <div class="header-actions">
        ${themeControl()}${button('← Back to notebook', 'close-settings')}
      </div>
    </header>
    <main class="settings-layout">
      <nav aria-label="Settings">
        ${tab('agent', 'Agent & model')}${tab('branding', 'Branding')}${tab(
          'voice',
          'Voice'
        )}${tab('keys', 'API keys')}
      </nav>
      <section class="settings-content">
        ${!data
          ? '<p>Loading settings…</p>'
          : panel === 'agent'
            ? '<h1>Agent & model</h1><div data-agent-settings></div>'
            : panel === 'voice'
              ? voicePanel(data, capture, busy)
              : panel === 'branding'
                ? brandingPanel(data, projectId)
                : keysPanel(data)}
        <p id="settings-message" role="status"></p>
      </section>
    </main>`
}
const voicePanel = (
  data: StudioSettings,
  capture: Recording,
  busy: boolean
) => {
  const clones = [...data.voice.clones].sort((a, b) =>
    b.consentAt.localeCompare(a.consentAt)
  )
  return html`<h1>Your voice</h1>
    <p>Used where you are off camera. On camera, it is always you.</p>
    <section class="settings-card">
      <h2>Clone your voice</h2>
      ${clones
        .map(
          (clone) =>
            html`<div class="clone-state">
              <strong
                >${clone.state === 'ready'
                  ? '✓ Your voice clone is ready.'
                  : clone.state === 'failed'
                    ? escape(clone.error || 'Your clone needs another try.')
                    : 'Making your voice clone…'}</strong
              >${clone.sampleKey
                ? html`<audio
                      controls
                      src="/objects/${clone.sampleKey}"
                      aria-label="Voice clone sample"
                    ></audio>
                    <div>
                      ${button(
                        'Use my clone',
                        `use-clone:${clone.id}`,
                        true,
                        busy
                      )}
                    </div>`
                : ''}${clone.state === 'failed'
                ? button('Try again', `retry-clone:${clone.id}`, false, busy)
                : ''}${['ready', 'failed'].includes(clone.state)
                ? button(
                    'Delete clone',
                    `delete-clone:${clone.id}`,
                    false,
                    busy
                  )
                : ''}
            </div>`
        )
        .join('')}${capture.phase === 'recording'
        ? html`<p class="clone-clock">Recording · 0s / 30s</p>
            <blockquote class="clone-script">
              ${escape(CLONE_SCRIPT)}
            </blockquote>
            ${button('Finish read', 'finish-clone-read', true, true)}`
        : capture.phase === 'preparing'
          ? '<p>Opening your microphone…</p>'
          : capture.phase === 'reviewing' && capture.url
            ? html`<p>Listen to your read before creating your clone.</p>
                <audio controls src="${capture.url}"></audio
                ><label class="consent"
                  ><input id="clone-consent" type="checkbox" /> This is my
                  voice, and I agree to send this read to Fish Audio to create a
                  private voice clone.</label
                >
                <div>
                  ${button(
                    'Record again',
                    'record-clone',
                    false,
                    busy
                  )}${button(
                    busy ? 'Making your clone…' : 'Create my clone',
                    'upload-clone',
                    true,
                    busy
                  )}
                </div>`
            : html`<p>
                  Read the script aloud for about 30 seconds in a quiet room.
                </p>
                ${button(
                  'Record my voice · 30s',
                  'record-clone',
                  false,
                  busy || !data.voice.hasKey
                )}${!data.voice.hasKey
                  ? '<p class="settings-note">Add your Fish Audio key in API keys to create a clone.</p>'
                  : ''}`}
    </section>
    <section class="settings-card">
      <h2>Voice for new videos</h2>
      <form id="default-voice-form">
        <label
          >Off-camera voice<select name="voice">
            ${voiceChoices(data, data.voice.selected)}
          </select></label
        ><button class="primary" ${busy ? 'disabled' : ''}>
          Use this voice
        </button>
      </form>
      <p class="settings-note">You can still change it for one video.</p>
      <h3>Hear the voices</h3>
      <div class="voice-catalogue">
        ${data.voice.choices
          .map(
            (choice) =>
              html`<div>
                <span
                  ><strong>${escape(choice.name)}</strong
                  ><small
                    >${escape(choice.language)} ·
                    ${choice.provider === 'system'
                      ? 'On this Mac'
                      : 'Fish Audio'}</small
                  ></span
                ><button
                  data-action="voice-preview"
                  data-voice="${escape(
                    voiceValue({ kind: 'ai', id: choice.id })
                  )}"
                  ${busy ? 'disabled' : ''}
                >
                  ▶ Preview
                </button>
              </div>`
          )
          .join('') ||
        '<p>No generated voices are available. Add a voice API key.</p>'}
      </div>
      <div id="voice-preview-player"></div>
      ${data.voice.error
        ? html`<p>${escape(data.voice.error)}</p>`
        : ''}${button('Refresh voices', 'refresh-voices', false, busy)}
    </section>`
}
const brandingPanel = (data: StudioSettings, projectId: string | null) =>
  html`<h1>Branding</h1>
    ${data.brandLibrary?.length
      ? `<h2>Saved brands</h2><div class="saved-brand-list">${data.brandLibrary.map((entry) => `<article><strong>${escape(entry.brand.name)}</strong><small>${escape(entry.domain || 'Custom brand')}</small><small>${escape(entry.brand.accent)}</small></article>`).join('')}</div>`
      : ''}
    <p>Your name and logo carry into your videos.</p>
    ${data.branding.fonts
      ? `<p>Fonts: ${escape(data.branding.fonts.display)} · ${escape(data.branding.fonts.body)} · ${escape(data.branding.fonts.mono)}</p>`
      : ''}
    ${data.branding.palette
      ? `<p>Palette: ${escape(data.branding.palette.ground)} · ${escape(data.branding.palette.text)} · ${escape(data.branding.accent)} · ${escape(data.branding.palette.secondary)}</p>`
      : ''}
    <form id="branding-form" class="settings-card">
      <label
        >Your name<input
          name="name"
          maxlength="100"
          value="${escape(data.branding.name)}" /></label
      ><label
        >Lower-third description<input
          name="tagline"
          maxlength="160"
          value="${escape(data.branding.tagline)}"
          placeholder="What you do" /></label
      ><label class="consent"
        ><input
          type="checkbox"
          name="useAccent"
          ${data.branding.useAccent ? 'checked' : ''}
        />
        Use my accent colour</label
      ><label
        >Accent colour<input
          type="color"
          name="accent"
          value="${data.branding.accent}" /></label
      ><label
        >Logo<input
          name="logo"
          type="file"
          accept="image/png,image/jpeg,image/webp" /></label
      >${data.branding.logoKey
        ? html`<div class="brand-logo-preview">
            <img
              src="/objects/${data.branding.logoKey}"
              alt="Current logo"
            />${button('Remove logo', 'remove-logo')}
          </div>`
        : ''}${projectId
        ? '<label class="consent"><input type="checkbox" name="apply" checked> Apply to this project too</label>'
        : ''}<button class="primary">Save branding</button>
    </form>`
const keysPanel = (data: StudioSettings) =>
  html`<h1>API keys</h1>
    <p>Keys stay with your studio’s server and are never shown again.</p>
    <form id="provider-settings-form" class="settings-card">
      <label
        >AI provider<select name="provider">
          ${data.providers
            .map(
              (provider) =>
                html`<option
                  value="${provider.id}"
                  ${data.models.provider === provider.id ? 'selected' : ''}
                >
                  ${escape(provider.name)}
                </option>`
            )
            .join('')}
        </select></label
      ><label
        >API URL<input
          name="baseUrl"
          type="url"
          required
          value="${escape(data.models.baseUrl)}" /></label
      ><label
        >Provider API key<input
          type="password"
          name="apiKey"
          autocomplete="new-password"
          placeholder="${data.models.hasKey
            ? 'Key saved · enter a replacement'
            : 'Enter your provider key'}" /></label
      >${(['writing', 'vision', 'coding'] as const)
        .map(
          (task) =>
            html`<label
              >${task === 'writing'
                ? 'Writing'
                : task === 'vision'
                  ? 'Vision'
                  : 'Animation coding'}
              model<input
                name="${task}"
                required
                value="${escape(data.models.models[task])}"
            /></label>`
        )
        .join('')}<label
        >Reasoning<select name="reasoningEffort">
          ${['none', 'low', 'medium', 'high']
            .map(
              (value) =>
                html`<option
                  ${data.models.reasoningEffort === value ? 'selected' : ''}
                >
                  ${value}
                </option>`
            )
            .join('')}
        </select></label
      ><button class="primary">Save AI settings</button>
    </form>
    <form id="voice-key-form" class="settings-card">
      <h2>Voice generation</h2>
      <label
        >Fish Audio API key<input
          name="fishApiKey"
          type="password"
          autocomplete="new-password"
          placeholder="${data.voice.hasKey
            ? 'Key saved · enter a replacement'
            : 'Enter your Fish Audio key'}" /></label
      ><button class="primary">Save voice key</button>
    </form>`
