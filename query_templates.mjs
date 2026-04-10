import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';
import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf-8');
const NEXT_PUBLIC_SUPABASE_URL = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1];
const SUPABASE_SERVICE_ROLE_KEY = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1];

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await supabase.from("message_templates")
    .select("trigger, message_template_variants(language_code, content)");
  console.log(JSON.stringify(data, null, 2));
}

main();
