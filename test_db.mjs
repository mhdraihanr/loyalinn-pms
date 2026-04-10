import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';
import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf-8');
const NEXT_PUBLIC_SUPABASE_URL = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1];
const SUPABASE_SERVICE_ROLE_KEY = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1];

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: res } = await supabase.from("reservations").select("tenant_id").eq("pms_reservation_id", "O8-R6").limit(1).single();
  console.log("Tenant:", res.tenant_id);

  const { data: tmpl } = await supabase.from("message_templates")
    .select("trigger, id, message_template_variants(language_code, content)")
    .eq("tenant_id", res.tenant_id);
    
  console.log(JSON.stringify(tmpl, null, 2));
}

main();
