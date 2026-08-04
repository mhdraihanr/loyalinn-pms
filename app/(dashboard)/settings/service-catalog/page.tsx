import { redirect } from "next/navigation";

import { ServiceCatalogManager } from "@/components/settings/service-catalog/service-catalog-manager";
import { getCurrentUserTenant } from "@/lib/auth/tenant";
import {
  deleteServiceCatalogCategory,
  deleteServiceCatalogItem,
  saveServiceCatalogCategory,
  saveServiceCatalogItem,
} from "@/lib/actions/service-catalog";
import { getCurrentTenantServiceCatalog } from "@/lib/data/service-catalog";

export const metadata = {
  title: "Menu & Facilities | Settings",
};

export const dynamic = "force-dynamic";

export default async function ServiceCatalogPage() {
  const tenantUser = await getCurrentUserTenant();
  if (!tenantUser) {
    redirect("/onboarding");
  }

  const catalog = await getCurrentTenantServiceCatalog();

  return (
    <ServiceCatalogManager
      initialData={catalog}
      canManage={tenantUser.role === "owner"}
      saveCategoryAction={saveServiceCatalogCategory}
      deleteCategoryAction={deleteServiceCatalogCategory}
      saveItemAction={saveServiceCatalogItem}
      deleteItemAction={deleteServiceCatalogItem}
    />
  );
}
