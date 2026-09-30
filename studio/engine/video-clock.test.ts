import { expect,it } from 'vitest'
import { sceneAt,videoSecond } from '../shared/video-clock'
import type { Project } from '../shared/model'
const project: Project={id:'fixture',title:'Fixture',source:'Fixture',slides:[],video:{settings:{presence:'off',voice:{kind:'record'}},scenes:[],transitions:['crossfade','none'],inputKey:'input',produced:{inputKey:'input',objectKey:'video.mp4',clock:[{sceneId:'one',start:0,duration:18},{sceneId:'two',start:17.6,duration:18},{sceneId:'three',start:35.6,duration:18}]}}}
it('seeking to an incoming scene selects its own context throughout the overlap',() => {
  expect(sceneAt(project,17.59)).toEqual({index:0,second:17.59})
  expect(sceneAt(project,videoSecond(project,1,0))).toEqual({index:1,second:0})
  expect(sceneAt(project,videoSecond(project,2,5))).toEqual({index:2,second:5})
})
