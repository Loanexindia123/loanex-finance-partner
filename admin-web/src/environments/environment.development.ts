/**
 * Development environment configuration for LoanEx Admin.
 * Still targets the shared deployed backend — no local/mock API.
 */
export const environment = {
  production: false,
  appName: 'LoanEx Admin',
  // Empty = same-origin /api → proxied to the deployed API via proxy.conf.json (avoids CORS).
  apiBaseUrl: '',
  apiPrefix: '/api/v1',
  enableDebug: true,
};
