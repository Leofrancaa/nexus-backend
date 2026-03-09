import path from 'node:path'
import { defineConfig } from 'prisma/config'
import { PrismaPg } from '@prisma/adapter-pg'

export default defineConfig({
    schema: path.join('prisma', 'schema.prisma'),
    migrate: {
        adapter: async () => {
            return new PrismaPg({ connectionString: process.env.DIRECT_URL })
        },
    },
})
