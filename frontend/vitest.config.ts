import { defineConfig } from 'vitest/config';

// Unit tests are pure logic/state tests — no Phaser, no DOM rendering of the
// game. jsdom is provided so state modules can exercise localStorage.
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/tests/**/*.test.ts'],
  },
});
