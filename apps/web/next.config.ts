import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // typedRoutes desactivado: causa errores con URLs dinámicas (callbackUrl, query params, etc.)
  // y no aporta valor suficiente para justificar los workarounds en cada Link/router.push.
  typedRoutes: false,
};

export default nextConfig;
