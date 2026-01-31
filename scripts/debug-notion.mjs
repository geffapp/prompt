import 'dotenv/config';
import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_TOKEN });

console.log('Client type:', typeof notion);
console.log('Top-level keys:', Object.keys(notion));
console.log('databases value:', notion.databases);
console.log('databases keys:', notion.databases ? Object.keys(notion.databases) : null);
console.log('typeof notion.databases?.query:', typeof notion.databases?.query);
