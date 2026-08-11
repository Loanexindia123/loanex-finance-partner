/**
 * Production environment configuration for LoanEx Admin.
 * Points at the existing shared backend — never a separate/new API.
 */
export const environment = {
  production: true,
  appName: 'LoanEx Admin',
  apiBaseUrl: 'https://loanex-api.vercel.app',
  apiPrefix: '/api/v1',
  enableDebug: false,
};
