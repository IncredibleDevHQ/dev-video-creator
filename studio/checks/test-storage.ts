import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {afterAll} from 'vitest'
// Unit and media checks must never inherit the creator's deployed store.
process.env.MINIMAL_STUDIO_PERSISTENCE='local'
delete process.env.MINIMAL_STUDIO_DATABASE_URL

// Set this before test-module imports, including modules imported for helpers.
const root=await mkdtemp(join(tmpdir(),'studio-test-store-'))
process.env.MINIMAL_STUDIO_DATA_DIR=root
afterAll(()=>rm(root,{recursive:true,force:true}))
