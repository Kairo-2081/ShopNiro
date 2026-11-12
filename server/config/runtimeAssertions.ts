type RuntimeEnvironment = Record<string, string | undefined>;

const isHttpsOrigin = (value: string | undefined): boolean => {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && !url.username
      && !url.password
      && url.pathname === '/'
      && !url.search
      && !url.hash;
  } catch {
    return false;
  }
};

export function assertRuntimeConfiguration(env: RuntimeEnvironment = process.env): void {
  const nodeEnvironment = env.NODE_ENV;
  if (!nodeEnvironment) throw new Error('NODE_ENV must be set explicitly.');

  if (nodeEnvironment === 'development' || nodeEnvironment === 'test') {
    if (env.SHOPNIRO_ENV && env.SHOPNIRO_ENV !== nodeEnvironment) {
      throw new Error(`SHOPNIRO_ENV must match NODE_ENV=${nodeEnvironment} outside deployed environments.`);
    }
    return;
  }

  if (nodeEnvironment !== 'production') {
    throw new Error('NODE_ENV must be development, test, or production.');
  }

  const deploymentEnvironment = env.SHOPNIRO_ENV;
  if (deploymentEnvironment !== 'staging' && deploymentEnvironment !== 'production') {
    throw new Error('SHOPNIRO_ENV must be set to staging or production on deployed services.');
  }
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters.');
  }
  if (!env.CRON_SECRET || env.CRON_SECRET.length < 32) {
    throw new Error('CRON_SECRET must be configured with at least 32 characters.');
  }
  if (!isHttpsOrigin(env.FRONTEND_URL || env.SHOPNIRO_PUBLIC_URL)) {
    throw new Error('FRONTEND_URL must be an HTTPS origin in deployed environments.');
  }
  if (env.PAYMENT_SIMULATOR === 'true') {
    throw new Error('PAYMENT_SIMULATOR must not be enabled in deployed environments.');
  }

  if (deploymentEnvironment === 'production') {
    if (env.SSLCOMMERZ_IS_SANDBOX !== 'false' || env.PAYMENT_MODE === 'sandbox-demo') {
      throw new Error('Production requires live SSLCommerz mode; sandbox payments are prohibited.');
    }
    return;
  }

  if (env.SSLCOMMERZ_IS_SANDBOX !== 'true' || env.PAYMENT_MODE !== 'sandbox-demo') {
    throw new Error('Staging requires isolated SSLCommerz sandbox credentials and PAYMENT_MODE=sandbox-demo.');
  }
}
