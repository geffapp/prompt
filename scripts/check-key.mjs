import 'dotenv/config';

const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

console.log('url:', url);
console.log('key_prefix:', key.slice(0, 12));
console.log('key_len:', key.length);
console.log('has_newline:', key.includes('\n'));
console.log('has_space:', key.includes(' '));
