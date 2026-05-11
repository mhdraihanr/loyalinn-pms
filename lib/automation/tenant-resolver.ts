const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type TenantLookupQuery = {
  select: (columns: "id") => {
    eq: (
      column: "slug",
      value: string,
    ) => {
      maybeSingle: () => PromiseLike<{
        data: { id: string } | null;
        error: { message: string } | null;
      }>;
    };
  };
};

export type TenantLookupClient = {
  from: (table: "tenants") => unknown;
};

export async function resolveTenantIdForWebhook(
  adminClient: TenantLookupClient,
  tenantKey: string,
) {
  if (UUID_PATTERN.test(tenantKey)) {
    return tenantKey;
  }

  const tenantQuery = adminClient.from("tenants") as TenantLookupQuery;

  const { data, error } = await tenantQuery
    .select("id")
    .eq("slug", tenantKey)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve tenant_key: ${error.message}`);
  }

  if (!data?.id) {
    throw new Error(`Unknown tenant_key: ${tenantKey}`);
  }

  return data.id;
}
