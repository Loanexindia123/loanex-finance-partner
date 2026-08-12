import fs from 'node:fs';
import path from 'node:path';
import { Express } from 'express';
import swaggerUi from 'swagger-ui-express';

function resolveOpenApiPath(): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'docs', 'openapi.json'),
    path.resolve(process.cwd(), 'backend', 'docs', 'openapi.json'),
    // Compiled file lives in dist/config — walk up to package docs/
    path.resolve(__dirname, '..', '..', 'docs', 'openapi.json'),
    path.resolve(__dirname, '..', '..', '..', 'docs', 'openapi.json'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function setupSwagger(app: Express): void {
  const openApiPath = resolveOpenApiPath();
  if (!openApiPath) {
    // Never crash the whole API (e.g. Vercel bundle missing docs/) — skip Swagger only.
    console.warn(
      '[Swagger] docs/openapi.json not found — /api-docs disabled. Checked cwd=%s',
      process.cwd(),
    );
    return;
  }

  const document = JSON.parse(fs.readFileSync(openApiPath, 'utf8')) as Record<string, unknown>;

  app.get('/api-docs.json', (_req, res) => {
    res.json(document);
  });

  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(document, {
      customSiteTitle: 'LoanEx API Docs',
      swaggerOptions: {
        persistAuthorization: true,
      },
    }),
  );
}
