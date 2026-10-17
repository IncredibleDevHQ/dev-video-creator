import { defineConfig } from 'vitest/config'
export default defineConfig({test:{setupFiles:['./checks/test-storage.ts'],include:process.env.MINIMAL_STUDIO_LIVE==='1'?['engine/**/*.test.ts','checks/**/*.test.ts']:['engine/**/*.test.ts']}})
