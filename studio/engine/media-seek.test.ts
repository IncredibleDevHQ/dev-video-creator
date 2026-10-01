import {expect,it} from 'vitest'
import {seekSavedMedia} from '../app/media-seek'
class Media extends EventTarget {
 readyState=0;duration=NaN;position=0;writes=0
 get currentTime(){return this.position}
 set currentTime(value:number){if(!this.readyState)throw new Error('No metadata');this.position=value;this.writes++}
}
it('waits for metadata and uses only the latest requested moment without starting playback',()=>{
 const media=new Media(),player=media as unknown as HTMLMediaElement
 seekSavedMedia(player,3.3);seekSavedMedia(player,12)
 expect(media.writes).toBe(0)
 media.readyState=1;media.duration=36;media.dispatchEvent(new Event('loadedmetadata'))
 expect(media.currentTime).toBe(12);expect(media.writes).toBe(1)
 media.dispatchEvent(new Event('loadedmetadata'));expect(media.writes).toBe(1)
})
it('clamps a saved position to the measured file and cancels an obsolete deferred seek',()=>{
 const media=new Media(),player=media as unknown as HTMLMediaElement
 seekSavedMedia(player,12);media.readyState=1;media.duration=5
 seekSavedMedia(player,20);media.dispatchEvent(new Event('loadedmetadata'))
 expect(media.currentTime).toBe(5);expect(media.writes).toBe(1)
 seekSavedMedia(player,NaN);seekSavedMedia(player,-1);expect(media.writes).toBe(1)
})
