import { createClient } from "@/lib/supabase/server";
import { TemplatesTabs } from "@/components/settings/templates-tabs";
import { revalidatePath } from "next/cache";
import { getCurrentUserTenant } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { TemplateVariant } from "@/components/settings/template-form";

export default async function TemplatesPage() {
  const userTenant = await getCurrentUserTenant();
  if (!userTenant) redirect("/login");

  const supabase = await createClient();

  const { data: templates } = await supabase
    .from("message_templates")
    .select(
      "id, trigger, message_template_variants(id, language_code, content)",
    )
    .eq("tenant_id", userTenant.tenantId);

  const getVariantsForTrigger = (trigger: string): TemplateVariant[] => {
    // Note: Due to the UNIQUE trigger_event, we just find the first match
    const t = templates?.find((t: any) => t.trigger === trigger);
    return t?.message_template_variants || [];
  };

  const variantsData = {
    "pre-arrival": getVariantsForTrigger("pre-arrival"),
    "on-stay": getVariantsForTrigger("on-stay"),
    "post-stay": getVariantsForTrigger("post-stay"),
  };

  async function saveTemplates(
    triggerEvent: string,
    variants: TemplateVariant[],
  ) {
    "use server";

    const userTenant = await getCurrentUserTenant();
    if (!userTenant) throw new Error("Unauthorized");
    const supabaseServer = await createClient();

    // Upsert template
    // Note: The schema for message_templates uses 'trigger' not 'trigger_event' (which I mistakenly wrote in the DB schema file? wait.)
    // Let me check my migration script:
    // ALTER TABLE message_templates ADD CONSTRAINT unique_tenant_trigger UNIQUE(tenant_id, trigger);
    // So the column is called `trigger`.

    const { data: template, error: tmplError } = await supabaseServer
      .from("message_templates")
      .upsert(
        {
          tenant_id: userTenant.tenantId,
          trigger: triggerEvent,
          name: triggerEvent + " Template", // 'name' was NOT null in original schema
        },
        { onConflict: "tenant_id, trigger" },
      )
      .select("id")
      .single();

    if (tmplError) throw new Error(tmplError.message);

    // Delete existing variants
    await supabaseServer
      .from("message_template_variants")
      .delete()
      .eq("template_id", template.id);

    // Insert new variants
    const inserts = variants.map((v) => ({
      template_id: template.id,
      language_code: v.language_code,
      content: v.content,
    }));

    const { error: varError } = await supabaseServer
      .from("message_template_variants")
      .insert(inserts);

    if (varError) throw new Error(varError.message);

    revalidatePath("/settings/templates");
  }

  return (
    <TemplatesTabs variantsData={variantsData} saveAction={saveTemplates} />
  );
}
