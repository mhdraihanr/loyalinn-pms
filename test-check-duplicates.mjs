import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf-8');
const urlMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function check() {
  const { data, error } = await supabase.from('reservations').select('id, pms_reservation_id, created_at, room_number').order('created_at', { ascending: false });
  
  const groups = {};
  data.forEach(r => {
    if(!groups[r.pms_reservation_id]) groups[r.pms_reservation_id] = [];
    groups[r.pms_reservation_id].push(r);
  });
  
  for (const [key, rows] of Object.entries(groups)) {
    if (rows.length > 1) {
      console.log(`Duplicate found for ${key}:`, rows.length, 'rows');
      console.log(rows);
    }
  }
}

check();
