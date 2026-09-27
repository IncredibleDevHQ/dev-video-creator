// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { firstFieldOf, settleDialogFocus } from './dialog'

// happy-dom lays nothing out: every element counts as shown.
const layOut = () => { Element.prototype.getClientRects = function () { return [{}] as unknown as DOMRectList } }

describe('a dialog that opens on its first field', () => {
  it('takes the keyboard from the close button to the first field past the heading', () => {
    layOut()
    document.body.innerHTML = '<dialog open><div class="modal-heading"><h2>Paste a document</h2><button class="icon-button" aria-label="Close" data-icon="x"></button></div><textarea id="markdown"></textarea><div class="modal-actions"><button class="button ghost">Cancel</button><button class="button primary">Replace notebook</button></div></dialog>'
    const dialog = document.querySelector('dialog')!
    ;(dialog.querySelector('.icon-button') as HTMLElement).focus()
    settleDialogFocus(dialog)
    expect(document.activeElement?.id).toBe('markdown')
  })

  it('reaches a radio group at its chosen radio, and with no field, the first control that is not a close', () => {
    layOut()
    document.body.innerHTML = '<dialog open><div class="modal-heading"><button class="icon-button" aria-label="Close publish"></button></div><label><input type="radio" name="scope" value="all"></label><label><input type="radio" name="scope" value="scene" checked></label></dialog>'
    expect((firstFieldOf(document.querySelector('dialog')!) as HTMLInputElement).value).toBe('scene')
    document.body.innerHTML = '<dialog open><div class="modal-heading"><button value="cancel" class="icon-button" aria-label="Close"></button></div><p>Nothing to fill in.</p><div class="modal-actions"><button value="cancel" class="button ghost">Cancel</button><button class="button primary">Export</button></div></dialog>'
    expect(firstFieldOf(document.querySelector('dialog')!)?.textContent).toBe('Cancel')
  })

  it('leaves the keyboard where the opener put it', () => {
    layOut()
    document.body.innerHTML = '<dialog open><div class="modal-heading"><button class="icon-button" aria-label="Close"></button></div><input id="first"><input id="chosen"></dialog>'
    const dialog = document.querySelector('dialog')!
    ;(document.getElementById('chosen') as HTMLElement).focus()
    settleDialogFocus(dialog)
    expect(document.activeElement?.id).toBe('chosen')
  })

  it('moves on from a link in the heading to the first field', () => {
    layOut()
    document.body.innerHTML = '<dialog open><div class="modal-heading"><h2>Scene studio</h2><button id="versions" class="se-link-quiet">Versions</button><button class="icon-button" aria-label="Close"></button></div><textarea id="script"></textarea></dialog>'
    const dialog = document.querySelector('dialog')!
    ;(document.getElementById('versions') as HTMLElement).focus()
    settleDialogFocus(dialog)
    expect(document.activeElement?.id).toBe('script')
  })
})
