import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://nrcxdracunplqnkrfbdg.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yY3hkcmFjdW5wbHFua3JmYmRnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM5NjQwOCwiZXhwIjoyMDg2OTcyNDA4fQ.fBPLKVu9U5fHxUNcEAQ1iE5q-7-858EbDpBDKb_Q5DA');
async function run() {
  const { data, error } = await supabase.from('message_templates').select('id, tenant_id, trigger, message_template_variants(id, language_code, content)');
  console.log('Error:', error);
  console.log('Data:', JSON.stringify(data, null, 2));
}
run();
