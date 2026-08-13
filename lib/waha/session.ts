const DEFAULT_SESSION_NAME = "default";

function getConfiguredDefaultTenantId() {
  const value = process.env.WAHA_DEFAULT_TENANT_ID?.trim();
  return value || null;
}

export type DefaultWahaSession = {
  sessionName: typeof DEFAULT_SESSION_NAME;
  tenantId: string;
};

export function resolveDefaultWahaSessionForTenant(
  tenantId: string,
): DefaultWahaSession | null {
  const configuredTenantId = getConfiguredDefaultTenantId();

  if (!configuredTenantId || configuredTenantId !== tenantId) {
    return null;
  }

  return { sessionName: DEFAULT_SESSION_NAME, tenantId };
}

export function resolveDefaultWahaWebhookTenant(sessionName: string) {
  const configuredTenantId = getConfiguredDefaultTenantId();

  if (sessionName !== DEFAULT_SESSION_NAME || !configuredTenantId) {
    return null;
  }

  return configuredTenantId;
}

export function getDefaultWahaSessionName() {
  return DEFAULT_SESSION_NAME;
}
