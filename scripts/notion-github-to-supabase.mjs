import 'dotenv/config';
import { Client } from '@notionhq/client';
import { createClient } from '@supabase/supabase-js';

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const supabaseUrl = process.env.SUPABASE_URL;

const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase credentials in .env'
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);

const DATABASE_ID = process.env.NOTION_DATABASE_ID;

/* ---------- Notion property helpers ---------- */

const getTitle = (p) => p?.title?.map(t => t.plain_text).join('') || '';
const getText = (p) => p?.rich_text?.map(t => t.plain_text).join('') || '';
const getCheckbox = (p) => Boolean(p?.checkbox);
const getNumber = (p) => (typeof p?.number === 'number' ? p.number : null);
const getMulti = (p) => p?.multi_select?.map(x => x.name) || [];
const getUrl = (p) => p?.url || '';

/* ---------- GitHub URL normalisation ---------- */

function toRawGitHubUrl(url) {
  if (!url) return '';
  if (url.includes('raw.githubusercontent.com')) return url;

  const m = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/);
  if (m) {
    const [, owner, repo, branch, filePath] = m;
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
  }
  return url;
}

async function fetchMarkdown(promptUrl) {
  const rawUrl = toRawGitHubUrl(promptUrl);
  if (!rawUrl) throw new Error('Missing Prompt_URL');

  const res = await fetch(rawUrl);
  if (!res.ok) throw new Error(`GitHub fetch failed (${res.status})`);

  return await res.text();
}

/* ---------- Notion DB pagination ---------- */

async function fetchAllNotionPages() {
  let results = [];
  let cursor;

  do {
    const resp = await notion.databases.query({
      database_id: DATABASE_ID,
      start_cursor: cursor,
      page_size: 100,
    });

    results.push(...resp.results);
    cursor = resp.has_more ? resp.next_cursor : null;
  } while (cursor);

  return results;
}

/* ---------- Main mapping (matches YOUR columns) ---------- */
/**
 * ⚠️ property names must match Notion exactly:
 * Name, Prompt_URL, Description, Prompt Tags, is_validated, prompt_id, is_published
 */
async function mapAndUpsert(page) {
  const p = page.properties;

  const prompt_id = getNumber(p.prompt_id);
  if (prompt_id === null) throw new Error('prompt_id is empty or not a number');

  const name = getTitle(p.Name);
  const description = getText(p.Description);
  const tags = getMulti(p['Prompt Tags']);
  const github_url = getUrl(p.Prompt_URL);
  const is_published = getCheckbox(p.is_published);

  // optional: you chose to map is_featured <- is_validated
  const is_featured = getCheckbox(p.is_validated);

  const prompt_text = await fetchMarkdown(github_url);

  const row = {
    prompt_id,
    name,
    description,
    prompt_text,
    tags,
    github_url,
    is_featured,
    is_published,
  };

  const { error } = await supabase
    .from('prompts')
    .upsert(row, { onConflict: 'prompt_id' });

  if (error) throw new Error(error.message);
}

async function main() {
  if (!process.env.NOTION_TOKEN || !process.env.NOTION_DATABASE_ID) {
    throw new Error('Missing NOTION_TOKEN or NOTION_DATABASE_ID in .env');
  }
  // Supabase vars can be provided as SUPABASE_* (backend) or VITE_SUPABASE_* (frontend/Bolt)
  // `supabaseUrl` and `supabaseKey` were resolved at the top of the file.
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials in .env');
  }

  console.log('📥 Reading Notion database...');
  const pages = await fetchAllNotionPages();
  console.log(`✅ Rows found: ${pages.length}`);

  let ok = 0, fail = 0;

  for (const page of pages) {
    try {
      await mapAndUpsert(page);
      ok++;
      console.log(`✅ Upserted prompt_id ${page.properties?.prompt_id?.number}`);
    } catch (e) {
      fail++;
      console.error(`❌ Failed: ${e.message}`);
    }
  }

  console.log('\n📊 Summary');
  console.log(`✅ Success: ${ok}`);
  console.log(`❌ Failed: ${fail}`);
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});