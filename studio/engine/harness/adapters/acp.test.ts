import { it, expect } from 'vitest'
import { acpEvents, runAcp } from './acp'
import type { HarnessEvent } from '../types'
it('counts streamed work without saving reasoning and counts each tool only once', () => {
  const events: HarnessEvent[] = []
  let time = 10000
  const accept = acpEvents(
    (event) => events.push(event),
    () => time
  )
  accept({
    sessionUpdate: 'agent_thought_chunk',
    content: { type: 'text', text: 'Private reasoning fixture' }
  })
  time += 100
  accept({
    sessionUpdate: 'agent_thought_chunk',
    content: { text: 'More private reasoning' }
  })
  time += 5000
  accept({
    sessionUpdate: 'tool_call',
    toolCallId: 'one',
    kind: 'edit',
    title: 'Write'
  })
  accept({
    sessionUpdate: 'tool_call',
    toolCallId: 'one',
    kind: 'edit',
    title: 'Write'
  })
  accept({
    sessionUpdate: 'tool_call_update',
    toolCallId: 'one',
    rawInput: { private: 'arguments' }
  })
  expect(events.map((e) => e.type)).toEqual(['activity', 'activity', 'tool'])
  expect(JSON.stringify(events)).not.toMatch(/Private|reasoning|arguments/)
})
const server = `const rl=require('node:readline').createInterface({input:process.stdin});rl.on('line',line=>{const m=JSON.parse(line);let result={};if(m.method==='session/new')result={sessionId:'fixture-session',modes:{availableModes:[{id:'auto'}]}};if(m.method==='session/prompt'){process.stdout.write(JSON.stringify({jsonrpc:'2.0',method:'session/update',params:{sessionId:'fixture-session',update:{sessionUpdate:'agent_thought_chunk',content:{type:'text',text:'Private fixture reasoning'}}}})+'\\n');result={stopReason:'end_turn'}};process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,result})+'\\n')});`
it('negotiates a session and observes streaming work from a real subprocess', async () => {
  const events: HarnessEvent[] = []
  const result = await runAcp({
    command: process.execPath,
    args: ['-e', server],
    cwd: process.cwd(),
    task: 'Synthetic protocol test',
    model: 'fixture-model',
    onEvent: (e) => events.push(e),
    signal: new AbortController().signal
  })
  expect(result).toEqual({ exitCode: 0, resumeId: 'fixture-session' })
  expect(events.map((e) => e.type)).toEqual(['session', 'activity'])
  expect(JSON.stringify(events)).not.toContain('Private')
})
it('cancels after handshake without sending a prompt or leaving the process running', async () => {
  const controller = new AbortController()
  const result = await runAcp({
    command: process.execPath,
    args: ['-e', server],
    cwd: process.cwd(),
    task: 'Must not be sent',
    onEvent: (e) => {
      if (e.type === 'session') controller.abort()
      else throw new Error('Unexpected model activity')
    },
    signal: controller.signal
  })
  expect(result).toEqual({ exitCode: 130, resumeId: 'fixture-session' })
})
