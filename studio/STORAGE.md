# Notebook artifacts and resume

Use `MINIMAL_STUDIO_PERSISTENCE=postgres-s3` on the server. PostgreSQL and the S3 bucket are required in this mode; a failed connection does not fall back to local files. `.env.example` lists the parameters. `yarn dev` loads the ignored `.env`; `yarn start` starts just the engine with it.

Configure `MINIMAL_STUDIO_DATABASE_URL`, `MINIMAL_STUDIO_S3_BUCKET`, and `MINIMAL_STUDIO_S3_REGION`. For MinIO or another compatible provider, set the full `MINIMAL_STUDIO_S3_ENDPOINT` URL and `MINIMAL_STUDIO_S3_FORCE_PATH_STYLE=true`. For AWS, omit the endpoint and use the standard credential chain, including an IAM workload role. Alternatively set `MINIMAL_STUDIO_S3_ACCESS_KEY_ID`, `MINIMAL_STUDIO_S3_SECRET_ACCESS_KEY`, and optionally `MINIMAL_STUDIO_S3_SESSION_TOKEN`. Credentials belong only on the server. Create the bucket through infrastructure first; the app checks it without needing permission to create buckets.

The minimalist app's project ID is its notebook ID. Objects are grouped under:

```
notebooks/<notebook-id>/
  record-projects/<artifact-id>.json
  record-sources/<artifact-id>.json
  outline-candidate/<artifact-id>.json
  slide-artwork/<artifact-id>.svg
  scenes/<scene-id>/
    planning-candidate/<artifact-id>.json
    record-stage-checkpoints/<artifact-id>.json
    stage-composition/<artifact-id>.html
    moments/<moment-id>/
      moment-take/<artifact-id>.webm
      segment-voice/<artifact-id>.mp3
      moment-voice/<artifact-id>.mp3
    recording-original/<artifact-id>.webm
    recording-normalized/<artifact-id>.webm
    produced-scene/<artifact-id>.mp4
  produced-video/<artifact-id>.mp4
```

`MINIMAL_STUDIO_S3_PREFIX` changes the `notebooks` prefix. Global settings, brand logos and voice-clone library media are shared studio resources. The compositions copy used media into notebook-scoped artifacts. Credentials and global settings are stored only in PostgreSQL, never in notebook object artifacts.

`minimal_studio_artifacts` records each artifact's notebook, scene and moment IDs, kind, bucket, object key, durable `s3://bucket/key` URI, MIME type, byte length, SHA-256 checksum and upload status. `minimal_studio_rows` records current documents and stage state with a foreign key to the corresponding JSON artifact. Objects and stage artifacts are immutable versions; the current database pointer advances only after upload succeeds. Uploads begin pending. Startup reconciles pending uploads against actual object bytes. Object reads verify both length and checksum.

Source reads, outline checkpoints, planning candidates (including rejected candidates), plans, original/normalized recordings, takes, generated segment voices, mixed moment audio, alignment clocks, composition HTML/media, render outputs and joins are retained. Harness packets and stage output folders are archived; CLI authentication and MCP configuration files remain private. Composition file manifests retain logical filenames and artifact IDs, so bundles can be reconstructed on another worker.

Stage checkpoints are scoped to notebook, scene, stage and input fingerprint. Planning can reuse the accepted plan without another model request. Production saves each completed moment's audio, restores a matching composition bundle, and reuses a matching render. Joining likewise reuses a saved output and clock. Changed source, scripts, voice, presence, branding or transitions invalidate the relevant inputs, so an old artifact cannot silently replace newer work. Missing or corrupt objects fail visibly. Interrupted harness runs require an explicit retry rather than silently spending another model request.

A fresh worker reads the PostgreSQL rows and fetches their linked object artifacts; its local folder is only scratch space. Startup resumes interrupted project stages. Existing stage retry actions use the same checkpoints. The landing page's **Continue a notebook** list is server-backed, so reopening saved work does not depend on browser local storage. `GET /api/projects/<id>/artifacts` returns that notebook's artifact keys/URIs and stage manifests. Playback and downloads use the worker's `/objects/<key>` proxy with byte-range support; buckets stay private.

`yarn check:storage` provisions disposable PostgreSQL and MinIO containers, generates synthetic media, saves a notebook and completed stages, then starts a second process with a different empty local folder. It verifies render reuse, pending-upload reconciliation, notebook listing, artifact manifests, ranged media reads and corruption rejection. Containers and temporary folders are removed afterward. It never connects to the creator's database or bucket. Unit checks always force the isolated local backend.

Local development remains available with `MINIMAL_STUDIO_PERSISTENCE=local`. Switching an existing local library to remote storage requires migration of its rows and object keys; configuration alone does not migrate it. The current implementation has not been exercised against a live AWS account. The MinIO integration uses the same parameterized AWS SDK S3 client as deployment.
