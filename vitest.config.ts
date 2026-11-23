import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));
const files = ['programs', 'courses', 'curriculum', 'course_relations', 'course_equivalents', 'fields', 'course_fields', 'checklist', 'graduation_rules', 'requirement_courses'];

export default defineConfig({
  resolve: {
    alias: [
      ...files.map((name) => ({
        find: `@reference/${name}`,
        replacement: existsSync(`${root}data/${name}.json`)
          ? `${root}data/${name}.json`
          : `${root}src/test/fixtures/reference/${name}.json`,
      })),
      { find: '@', replacement: `${root}src` },
    ],
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/fixtures/setup-jsdom.ts'],
    clearMocks: true,
  },
});
