import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
const NEXT_PUBLIC_SUPABASE_URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1];
const SUPABASE_SERVICE_ROLE_KEY = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1];
const adminClient = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function detectPreferredLanguage(phone, country) {
  if (country) {
    const c = country.toLowerCase().trim();
    if (c === "indonesia" || c === "id") return "id";
    if (c === "china" || c === "zh") return "zh";
    if (c === "japan" || c === "jp") return "ja";
  }
  if (phone) {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("62") || phone.trim().startsWith("0")) return "id";
    if (cleaned.startsWith("86")) return "zh";
    if (cleaned.startsWith("81")) return "ja";
  }
  return "en";
}

function selectTemplateVariant(variants, preferredLanguage) {
  if (variants.length === 0) return null;
  return (
    variants.find((v) => v.language_code === preferredLanguage) ??
    variants.find((v) => v.language_code === "en") ??
    variants[0]
  );
}

async function debug() {
  const job = {
    tenantId: '2eeca5e3-07a2-4e93-89ce-9f9f67f95b8e',
    triggerType: 'on-stay',
    payload: { booking_id: 'O8-R6', status: 'on-stay' }
  };

  const { data: reservation, error } = await adminClient
    .from("reservations")
    .select("guests(name, phone, country)")
    .eq("tenant_id", job.tenantId)
    .eq("pms_reservation_id", job.payload.booking_id)
    .maybeSingle();
      
  console.log("Reservation Error:", error);
  const guest = Array.isArray(reservation?.guests) ? reservation.guests[0] : reservation?.guests;
  
  console.log("Guest data:", guest);

  const preferredLanguage = detectPreferredLanguage(guest?.phone, guest?.country);
  console.log("Preferred language:", preferredLanguage);

  const { data: template } = await adminClient
    .from("message_templates")
    .select("id, message_template_variants(language_code, content)")
    .eq("tenant_id", job.tenantId)
    .eq("trigger", job.triggerType)
    .maybeSingle();

  console.log("Template fetched:", JSON.stringify(template, null, 2));

  const templateVariant = selectTemplateVariant(
    template?.message_template_variants ?? [],
    preferredLanguage
  );

  console.log("Selected variant:", templateVariant?.language_code);
}

debug();
