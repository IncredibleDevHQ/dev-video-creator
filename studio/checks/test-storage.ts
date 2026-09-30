// Unit and media checks must never inherit the creator's deployed store.
process.env.MINIMAL_STUDIO_PERSISTENCE='local'
delete process.env.MINIMAL_STUDIO_DATABASE_URL
