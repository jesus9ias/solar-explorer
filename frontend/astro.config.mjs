// @ts-check
import { defineConfig } from 'astro/config';

// Solar Explorer is a fully static, frontend-only site. The build output in
// `dist/` is synced to S3 and served through CloudFront (see infra/).
export default defineConfig({
  output: 'static',
  build: {
    format: 'directory',
  },
});
