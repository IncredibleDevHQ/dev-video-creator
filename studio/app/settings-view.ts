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
        ${tab('agent', 'Agent & model')}${tab('branding', 'You')}${tab(
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
const swatch = (colour: string, label: string) =>
  `<i class="look-swatch" style="background:${escape(colour)}" title="${escape(label)}"></i>`
/** You in your videos (name, description, logo), then saved looks as swatches. */
const brandingPanel = (data: StudioSettings, projectId: string | null) =>
  html`<h1>You</h1>
    <p>
      Your name and logo appear in your videos, on the title card and the lower
      third. A notebook's colours and fonts are its look, changed beside its
      wireframes.
    </p>
    <form id="branding-form" class="settings-card">
      <label
        >Your name<input
          name="name"
          maxlength="100"
          value="${escape(data.branding.name)}"
          placeholder="How the video introduces you" /></label
      ><label
        >Lower-third description<input
          name="tagline"
          maxlength="160"
          value="${escape(data.branding.tagline)}"
          placeholder="What you do" /></label
      ><span class="field-label">Logo</span>
      <div class="file-control">
        ${data.branding.logoKey
          ? html`<img
              class="brand-logo-preview"
              src="/objects/${data.branding.logoKey}"
              alt="Your logo"
            />`
          : ''}<label class="file-button"
          ><input
            name="logo"
            type="file"
            class="sr"
            accept="image/png,image/jpeg,image/webp"
          />${data.branding.logoKey ? 'Replace logo…' : 'Choose a logo…'}</label
        ><span class="file-name" data-file-name
          >${data.branding.logoKey ? '' : 'PNG, JPEG or WebP'}</span
        >${data.branding.logoKey ? button('Remove', 'remove-logo') : ''}
      </div>
      ${projectId
        ? '<label class="consent"><input type="checkbox" name="apply" checked> Use in this notebook too</label>'
        : ''}<button class="primary">Save</button>
    </form>
    ${data.brandLibrary?.length
      ? html`<h2>Saved looks</h2>
          <div class="saved-looks">
            ${data.brandLibrary
              .map(
                (entry) =>
                  html`<article class="saved-look">
                    <span class="look-swatches"
                      >${swatch(
                        entry.brand.palette?.ground || '#ffffff',
                        'Background'
                      )}${swatch(
                        entry.brand.palette?.text || '#111111',
                        'Text'
                      )}${swatch(entry.brand.accent, 'Accent')}</span
                    ><strong
                      style="font-family:${escape(
                        entry.brand.fonts?.display || 'Inter'
                      )}, Inter, sans-serif"
                      >${escape(
                        entry.brand.look?.name || entry.brand.name || 'Look'
                      )}</strong
                    ><small
                      >${escape(
                        entry.domain ? `Used for ${entry.domain}` : 'Saved look'
                      )}</small
                    >
                  </article>`
              )
              .join('')}
          </div>`
      : ''}`
const keysPanel = (data: StudioSettings) =>
  html`<h1>API keys</h1>
    <p>Keys stay with your studio’s server and are never shown again.</p>
    ${data.harness
      ? html`<div class="settings-card agent-owns-models">
          <p>
            <b>Your agent writes and draws your videos.</b> The provider and
            models below are used only when no agent is chosen.
          </p>
          <details>
            <summary>Show provider settings</summary>
            ${providerForm(data)}
          </details>
        </div>`
      : providerForm(data)}
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

const providerForm = (data: StudioSettings) =>
  html`<form id="provider-settings-form" class="settings-card">
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
  </form>`
