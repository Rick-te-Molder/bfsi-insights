import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  console.log('Checking for invalid thumbnail data...');
  const { data, error } = await supabase
    .from('kb_publication')
    .select('slug, thumbnail, thumbnail_path');

  if (error) {
    console.error(error);
    return;
  }

  let found = false;
  data.forEach((p) => {
    const t = p.thumbnail;
    const tp = p.thumbnail_path;
    const bad =
      (t && (t.trim() === '' || t === '/' || t === '.png' || t.endsWith('/.png'))) ||
      (tp && (tp.trim() === '' || tp === '/' || tp === '.png'));

    if (bad) {
      console.log('❌ Found bad data:', p);
      found = true;
    }
  });

  if (!found) console.log('✅ No obvious bad data found in kb_publication.');
}

check();
