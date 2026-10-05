import { AgentSetup } from './agent-setup'
import { showError } from './error-surface'
import { confirmAction } from './confirm-action'
import { api } from './api'
import { Recording } from './recording'
import { settingsScreen, type SettingsPanel } from './settings-view'
import { parseVoice } from './voice-choice'
import { CLONE_SCRIPT, type StudioSettings } from '../shared/settings'
import type { Moment } from '../shared/model'
export class Settings {
  isOpen = false
  private agentSetup: AgentSetup | null = null
  private data: StudioSettings | null = null
  private panel: SettingsPanel = 'voice'
  private busy = false
  private poll: ReturnType<typeof setInterval> | null = null
  private epoch = 0
  private capture = new Recording(
    () => this.draw(),
    (seconds) => {
      const clock = this.root.querySelector('.clone-clock')
      if (clock) clock.textContent = `Recording · ${Math.floor(seconds)}s / 30s`
      const finish = this.root.querySelector<HTMLButtonElement>(
        '[data-action="finish-clone-read"]'
      )
      if (finish) finish.disabled = seconds < 25
      if (seconds >= 30 && this.capture.phase === 'recording')
        this.capture.next()
    }
  )
  constructor(
    private root: HTMLElement,
    private projectId: () => string | null,
    private back: () => void,
    private projectChanged: () => Promise<void>
  ) {
    root.addEventListener('click', (event) => {
      if (this.isOpen) void this.click(event).catch((error) => showError(error))
    })
    root.addEventListener('submit', (event) => {
      if (this.isOpen) {
        event.preventDefault()
        void this.submit(event).catch((error) => showError(error))
      }
    })
    root.addEventListener('change', (event) => {
      const file = event.target as HTMLInputElement
      if (this.isOpen && file.name === 'logo' && file.type === 'file') {
        const label = this.root.querySelector('[data-file-name]')
        if (label) label.textContent = file.files?.[0]?.name || ''
        return
      }
      if (
        !this.isOpen ||
        !this.data ||
        (event.target as HTMLSelectElement).name !== 'provider'
      )
        return
      const provider = this.data.providers.find(
        (provider) => provider.id === (event.target as HTMLSelectElement).value
      )
      const form = (event.target as HTMLSelectElement).form
      if (!provider || !form) return
      for (const [name, value] of Object.entries({
        baseUrl: provider.baseUrl,
        ...provider.models
      }))
        (form.elements.namedItem(name) as HTMLInputElement).value = value
      const key = form.elements.namedItem('apiKey') as HTMLInputElement
      key.value = ''
      key.placeholder = 'Enter the key for this provider'
    })
  }
  async open(panel: SettingsPanel = 'voice') {
    this.isOpen = true
    this.panel = panel
    this.draw()
    const epoch = ++this.epoch
    const [data, notebook] = await Promise.all([
      api.settings(),
      this.projectId() ? api.load(this.projectId()!) : Promise.resolve(null)
    ])
    if (epoch !== this.epoch || !this.isOpen) return
    this.data = { ...data, harness: notebook?.project.harness || data.harness }
    if (epoch !== this.epoch || !this.isOpen) return
    this.draw()
    if (this.poll) clearInterval(this.poll)
    this.poll = setInterval(() => {
      if (
        this.panel === 'voice' &&
        this.capture.phase === 'idle' &&
        !this.busy &&
        this.data?.voice.clones.some((clone) =>
          ['creating', 'training'].includes(clone.state)
        )
      )
        void this.refresh().catch(() => {})
    }, 5000)
  }
  close() {
    this.isOpen = false
    this.epoch++
    if (this.poll) clearInterval(this.poll)
    this.poll = null
    this.capture.dispose()
    this.agentSetup?.dispose()
    this.back()
  }
  private draw() {
    this.agentSetup?.dispose()
    this.agentSetup = null
    if (this.isOpen)
      this.root.innerHTML = settingsScreen(
        this.data,
        this.panel,
        this.capture,
        this.busy,
        this.projectId()
      )
    const host = this.root.querySelector<HTMLElement>('[data-agent-settings]')
    if (this.isOpen && host && this.data) {
      const epoch = this.epoch
      const id = this.projectId()
      this.agentSetup = new AgentSetup(
        host,
        this.data.harness,
        async (harness) => {
          const data = await api.saveSettings({
            harness,
            ...(id ? { projectId: id } : {})
          })
          if (epoch !== this.epoch || !this.isOpen) return
          this.data = data
          await this.projectChanged()
        },
        'Save selection',
        true
      )
    }
  }
  private message(text: string) {
    const target = this.root.querySelector('#settings-message')
    if (target) target.textContent = text
  }
  private async refresh(force = false) {
    const epoch = this.epoch
    const data = await api.settings(force)
    if (epoch !== this.epoch || !this.isOpen) return
    this.data = data
    this.draw()
  }
  private async click(event: Event) {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
      'button'
    )
    if (!target) return
    if (target.dataset.settingsPanel) {
      if (this.capture.phase !== 'idle') this.capture.dispose()
      this.panel = target.dataset.settingsPanel as SettingsPanel
      this.draw()
      return
    }
    const action = target.dataset.action
    if (action === 'close-settings') {
      this.close()
      return
    }
    if (this.busy) return
    if (action === 'record-clone') {
      if (this.capture.phase !== 'idle') this.capture.dispose()
      const moment: Moment = {
        id: 'voice-read',
        lines: CLONE_SCRIPT,
        start: 0,
        end: 30,
        camera: 'none',
        layout: 'corner',
        overlay: null,
        recordingKey: 'voice-read',
        take: null,
        audio: null,
        audioKey: 'voice-read'
      }
      await this.capture.start([moment])
      return
    }
    if (action === 'finish-clone-read') {
      this.capture.next()
      return
    }
    if (action === 'remove-logo' && this.data) {
      event.preventDefault()
      this.data.branding.logoKey = null
      this.draw()
      return
    }
    if (action === 'upload-clone') {
      if (!this.root.querySelector<HTMLInputElement>('#clone-consent')?.checked)
        throw new Error(
          'Confirm that this is your voice before creating a clone'
        )
      if (!this.capture.blob) return
      this.busy = true
      this.draw()
      try {
        await api.uploadClone(this.capture.blob, true)
        this.capture.dispose()
        await this.refresh()
      } finally {
        this.busy = false
        this.draw()
      }
      return
    }
    if (action === 'voice-preview') {
      target.disabled = true
      try {
        const result = await api.previewVoice(parseVoice(target.dataset.voice!))
        const player = this.root.querySelector('#voice-preview-player')
        if (player) {
          player.innerHTML = `<audio controls autoplay src="/objects/${result.objectKey}"></audio>`
          void player
            .querySelector('audio')
            ?.play()
            .catch(() => {})
        }
      } finally {
        target.disabled = false
      }
    }
    if (action?.startsWith('use-clone:')) {
      this.data = await api.saveSettings({
        voice: { kind: 'clone', id: action.slice(10) }
      })
      this.draw()
      this.message('Your clone is the voice for new videos.')
    }
    if (action?.startsWith('retry-clone:')) {
      await api.retryClone(action.slice(12))
      await this.refresh()
    }
    if (
      action?.startsWith('delete-clone:') &&
      (await confirmAction({
        title: 'Delete this voice?',
        detail:
          'This removes the voice clone and its saved read. Existing videos stay available.',
        action: 'Delete voice'
      }))
    ) {
      this.data = await api.deleteClone(action.slice(13))
      this.draw()
    }
    if (action === 'refresh-voices') await this.refresh(true)
  }
  private async submit(event: Event) {
    const form = event.target as HTMLFormElement
    const values = new FormData(form)
    if (!this.data || this.busy) return
    this.busy = true
    const submit = form.querySelector<HTMLButtonElement>('button.primary')
    if (submit) submit.disabled = true
    try {
      if (form.id === 'default-voice-form')
        this.data = await api.saveSettings({
          voice: parseVoice(String(values.get('voice')))
        })
      else if (form.id === 'voice-key-form')
        this.data = await api.saveSettings({
          fishApiKey: String(values.get('fishApiKey') || '')
        })
      else if (form.id === 'provider-settings-form')
        this.data = await api.saveSettings({
          models: {
            provider: String(values.get('provider')),
            baseUrl: String(values.get('baseUrl')),
            apiKey: String(values.get('apiKey') || ''),
            models: {
              writing: String(values.get('writing')),
              vision: String(values.get('vision')),
              coding: String(values.get('coding'))
            },
            reasoningEffort: String(values.get('reasoningEffort'))
          }
        })
      else if (form.id === 'branding-form') {
        let logoKey = this.data.branding.logoKey
        const logo = values.get('logo') as File | null
        if (logo?.size) logoKey = (await api.uploadLogo(logo)).objectKey
        this.data = await api.saveSettings({
          // Identity only: a notebook's colours and fonts are its look.
          branding: {
            ...this.data.branding,
            name: String(values.get('name')),
            tagline: String(values.get('tagline')),
            logoKey
          },
          ...(values.has('apply') && this.projectId()
            ? { projectId: this.projectId() }
            : {})
        })
        await this.projectChanged()
      } else return
    } finally {
      this.busy = false
      if (submit) submit.disabled = false
    }
    this.draw()
    this.message('Settings saved.')
  }
}
