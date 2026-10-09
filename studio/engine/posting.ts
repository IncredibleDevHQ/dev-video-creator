// Posting as the creator, from their own apps: X (each post is charged to
// the app's owner) and LinkedIn (as a member; company pages need vetted
// access). Only ever called on the creator's click; nothing posts itself.
// The request shapes follow the providers' public docs and are checked
// against stand-ins here: the first real post is the live check.
import { accessToken, accountFetch } from './accounts'
import { Refusal } from './refusal'

const json = async (response: Response, what: string) => {
  if (!response.ok)
    throw new Refusal(`${what} was refused (${response.status})`)
  // Some steps answer with an empty body (LinkedIn's finalize, X's append).
  const text = await response.text()
  return text ? (JSON.parse(text) as Record<string, unknown>) : {}
}
const pause = (ms: number) => new Promise((done) => setTimeout(done, ms))
type Processing = { state: string; check_after_secs?: number } | undefined
const CHUNK = 4 * 1024 * 1024

/** Uploads a video to X in chunks, and waits until X has processed it. */
const xVideo = async (bytes: Buffer, wait = 2000) => {
  const base = 'https://api.x.com/2/media/upload'
  const started = await json(
    await accountFetch('x', `${base}/initialize`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        media_type: 'video/mp4',
        total_bytes: bytes.length,
        media_category: 'tweet_video'
      })
    }),
    'X’s upload'
  )
  const id = String((started.data as { id?: string })?.id || '')
  if (!id) throw new Refusal('X did not take the video')
  for (let index = 0; index * CHUNK < bytes.length; index++) {
    const form = new FormData()
    form.append('segment_index', String(index))
    form.append(
      'media',
      new Blob([
        new Uint8Array(bytes.subarray(index * CHUNK, (index + 1) * CHUNK))
      ]),
      'teaser.mp4'
    )
    await json(
      await accountFetch('x', `${base}/${id}/append`, {
        method: 'POST',
        body: form
      }),
      'X’s upload'
    )
  }
  let info = (
    (
      await json(
        await accountFetch('x', `${base}/${id}/finalize`, { method: 'POST' }),
        'X’s upload'
      )
    ).data as { processing_info?: Processing }
  )?.processing_info
  for (let tries = 0; info && info.state !== 'succeeded'; tries++) {
    if (info.state === 'failed' || tries > 30)
      throw new Refusal('X could not process the video')
    await pause(Math.min(10, info.check_after_secs || 2) * (wait / 2))
    info = (
      (
        await json(
          await accountFetch('x', `${base}?media_id=${id}&command=STATUS`),
          'X’s upload'
        )
      ).data as { processing_info?: Processing }
    )?.processing_info
  }
  return id
}

/** No answer came to the request that publishes: the post may be out. */
export class UncertainPost extends Refusal {}

/**
 * The request that publishes. A sign-in problem is refused before it is
 * sent; once sent, a timeout or a dropped connection says nothing about
 * whether it went out (review 6: it was offered again, and X charged twice).
 */
const publishRequest = async (
  provider: 'x' | 'linkedin',
  url: string,
  init: RequestInit
) => {
  await accessToken(provider)
  try {
    return await accountFetch(provider, url, init)
  } catch (error) {
    if (error instanceof Refusal) throw error
    throw new UncertainPost(
      `${provider === 'x' ? 'X' : 'LinkedIn'} did not answer; the post may have gone out`
    )
  }
}

/** Posts on X; returns the post's link. */
export const postToX = async (
  text: string,
  video?: Buffer,
  options: { wait?: number } = {}
) => {
  const media = video ? await xVideo(video, options.wait) : null
  const body = await json(
    await publishRequest('x', 'https://api.x.com/2/tweets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text,
        ...(media ? { media: { media_ids: [media] } } : {})
      })
    }),
    'The post on X'
  )
  const id = (body.data as { id?: string })?.id
  if (!id) throw new Refusal('X did not say where the post is')
  return `https://x.com/i/web/status/${id}`
}

const LINKEDIN = {
  'LinkedIn-Version': '202509',
  'X-Restli-Protocol-Version': '2.0.0',
  'content-type': 'application/json'
}

/** Uploads a video to LinkedIn for the member, in the parts it asks for. */
const linkedinVideo = async (owner: string, bytes: Buffer) => {
  const started = await json(
    await accountFetch(
      'linkedin',
      'https://api.linkedin.com/rest/videos?action=initializeUpload',
      {
        method: 'POST',
        headers: LINKEDIN,
        body: JSON.stringify({
          initializeUploadRequest: {
            owner,
            fileSizeBytes: bytes.length,
            uploadCaptions: false,
            uploadThumbnail: false
          }
        })
      }
    ),
    'LinkedIn’s upload'
  )
  const value = started.value as {
    video: string
    uploadToken?: string
    uploadInstructions: Array<{
      uploadUrl: string
      firstByte: number
      lastByte: number
    }>
  }
  const parts: string[] = []
  for (const part of value.uploadInstructions) {
    const response = await fetch(part.uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': 'application/octet-stream' },
      body: new Uint8Array(bytes.subarray(part.firstByte, part.lastByte + 1)),
      signal: AbortSignal.timeout(300_000)
    })
    if (!response.ok)
      throw new Refusal(`LinkedIn’s upload was refused (${response.status})`)
    parts.push(response.headers.get('etag') || '')
  }
  await json(
    await accountFetch(
      'linkedin',
      'https://api.linkedin.com/rest/videos?action=finalizeUpload',
      {
        method: 'POST',
        headers: LINKEDIN,
        body: JSON.stringify({
          finalizeUploadRequest: {
            video: value.video,
            uploadToken: value.uploadToken || '',
            uploadedPartIds: parts
          }
        })
      }
    ),
    'LinkedIn’s upload'
  )
  return value.video
}

/** Posts on LinkedIn as the member; returns the post's link. */
export const postToLinkedIn = async (
  text: string,
  video?: Buffer,
  title = ''
) => {
  const { id } = await accessToken('linkedin')
  if (!id) throw new Refusal('Sign in to LinkedIn again')
  const author = `urn:li:person:${id}`
  const media = video ? await linkedinVideo(author, video) : null
  const response = await publishRequest(
    'linkedin',
    'https://api.linkedin.com/rest/posts',
    {
      method: 'POST',
      headers: LINKEDIN,
      body: JSON.stringify({
        author,
        commentary: text,
        visibility: 'PUBLIC',
        distribution: {
          feedDistribution: 'MAIN_FEED',
          targetEntities: [],
          thirdPartyDistributionChannels: []
        },
        ...(media ? { content: { media: { title, id: media } } } : {}),
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false
      })
    }
  )
  if (!response.ok)
    throw new Refusal(`The post on LinkedIn was refused (${response.status})`)
  const urn = response.headers.get('x-restli-id')
  return urn
    ? `https://www.linkedin.com/feed/update/${urn}/`
    : 'https://www.linkedin.com/feed/'
}

/** What a post on X costs the app's owner, at the prices in settings. */
export const xCost = (
  text: string,
  prices: { post: number; postWithLink: number }
) => (/https?:\/\//.test(text) ? prices.postWithLink : prices.post)
