/** Update the surrounding view without disconnecting a loaded video decoder. */
export function replacePlayerView(root:HTMLElement,html:string,player:HTMLMediaElement|null){
 const template=document.createElement('template');template.innerHTML=html
 const next=template.content.querySelector<HTMLMediaElement>('[data-scene-player],[data-take-player]')
 if(!player || !next || player.getAttribute('src')!==next.getAttribute('src')){root.replaceChildren(template.content);return false}
 const patch=(current:Element,replacement:Element|DocumentFragment)=>{
  if(replacement instanceof Element){
   for(const attribute of [...current.attributes])if(!replacement.hasAttribute(attribute.name))current.removeAttribute(attribute.name)
   for(const attribute of [...replacement.attributes])if(current.getAttribute(attribute.name)!==attribute.value)current.setAttribute(attribute.name,attribute.value)
  }
  if(current===player)return
  const kept=[...current.children].find(child=>child===player || child.contains(player))!
  const incoming=[...replacement.children].find(child=>child===next || child.contains(next))!
  patch(kept,incoming)
  for(const child of [...current.childNodes])if(child!==kept)child.remove()
  let before=true
  for(const child of [...replacement.childNodes]){
   if(child===incoming){before=false;continue}
   current.insertBefore(child,before?kept:null)
  }
 }
 patch(root,template.content)
 return true
}
