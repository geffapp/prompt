import 'dotenv/config';

const k = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
console.log('key_prefix:', k.slice(0, 12));
console.log('key_len:', k.length);
