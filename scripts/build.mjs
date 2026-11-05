import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { load } from 'cheerio';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temp = await mkdtemp(join(tmpdir(), 'gavmor-blog-'));
const input = join(temp, 'src');
const output = join(root, 'dist');

function run(entry, args) {
  execFileSync(process.execPath, [join(root, 'node_modules', entry), ...args], {
    cwd: root,
    stdio: 'inherit'
  });
}

function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function metadata(title, description, url, type) {
  const tags = [
    `<link rel="canonical" href="${escapeHtml(url)}">`,
    `<meta name="description" content="${escapeHtml(description)}">`,
    `<meta property="og:type" content="${type}">`,
    `<meta property="og:site_name" content="Gavin Morgan">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${escapeHtml(url)}">`,
    `<meta name="twitter:card" content="summary">`,
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`
  ];
  return tags.map(tag => `  ${tag}`).join('\n');
}

try {
  await cp(join(root, 'src'), input, { recursive: true });
  const source = await readFile(join(root, 'src/index.md'), 'utf8');
  const config = source.match(/<!--\s*@marss\s*([\s\S]*?)-->/)?.[1];
  const base = config?.match(/^htmlUrl:\s*(\S+)\s*$/m)?.[1];
  if (!base || !base.endsWith('/')) throw new Error('Set a trailing-slash htmlUrl in the @marss metadata.');
  const siteDescription = config.match(/^description:\s*(.+)$/m)?.[1]?.trim() || 'Notes and writing by Gavin Morgan.';

  const fragment = join(temp, 'index.html');
  const feed = join(temp, 'feed.xml');
  run('marss/dist/main.js', [join(root, 'src/index.md'), feed, fragment]);

  // Use marss's rendered headings and content for the index, pages, and RSS links.
  const $ = load(await readFile(fragment, 'utf8'), null, false);
  const posts = [];
  const slugs = new Set();
  $.root().children('h2').each((_, heading) => {
    const $heading = $(heading);
    const headingId = $heading.attr('id');
    let slug;
    let description;
    let body = '';
    for (let node = heading.next; node && !(node.type === 'tag' && node.name === 'h2'); node = node.next) {
      if (!description && node.type === 'tag' && node.name === 'p') {
        description = $(node).text().replace(/\s+/g, ' ').trim();
      }
      if (!description && node.type === 'comment') {
        const match = node.data.match(/^\s*slug:\s*([^\s]+)\s*$/);
        if (match) slug = match[1];
      }
      body += $.html(node);
    }
    slug ||= headingId;
    if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slugs.has(slug)) {
      throw new Error(`Post needs a unique lowercase hyphenated slug: ${$heading.text()}`);
    }
    slugs.add(slug);
    const title = $heading.text().trim().replace(/^\d{4}-\d{2}-\d{2}:\s*/, '');
    const headingHtml = escapeHtml(title);
    const path = `posts/${slug}.html`;
    const url = new URL(path, base).href;
    posts.push({ title, headingHtml, headingId, body, path, url,
      description: (description || siteDescription).slice(0, 200) });
    $heading.html(`<a href="${path}">${headingHtml}</a>`);
  });

  await writeFile(join(input, 'index.md'), $.root().html());
  await rm(output, { recursive: true, force: true });
  run('@benchristel/mdsite/dist/main.js', ['-i', input, '-o', output, '-t', join(root, 'template.html')]);

  const indexPath = join(output, 'index.html');
  const index = await readFile(indexPath, 'utf8');
  await writeFile(indexPath, index.replace('<body>', '<body class="blog-index">').replace('</head>', `${metadata('Gavin Morgan', siteDescription, base, 'website')}\n</head>`));

  const template = await readFile(join(root, 'template.html'), 'utf8');
  await mkdir(join(output, 'posts'), { recursive: true });
  for (const post of posts) {
    const page = template
      .replace('{{title}}', escapeHtml(`${post.title} | Gavin Morgan`))
      .replace('{{content}}', `<h1 id="${escapeHtml(post.headingId || post.path)}">${post.headingHtml}</h1>${post.body}`)
      .replaceAll('href="./', 'href="../')
      .replace('</head>', `${metadata(post.title, post.description, post.url, 'article')}\n</head>`);
    await writeFile(join(output, post.path), page);
  }

  let itemCount = 0;
  const rss = (await readFile(feed, 'utf8')).replace(/<item>[\s\S]*?<\/item>/g, item => {
    const post = posts[itemCount++];
    if (!post || !/<link>[\s\S]*?<\/link>/.test(item)) throw new Error('RSS items do not match post headings.');
    return item.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(post.title)}</title>`)
      .replace(/<link>[\s\S]*?<\/link>/, `<link>${escapeHtml(post.url)}</link>`);
  });
  if (itemCount !== posts.length) throw new Error('RSS items do not match post headings.');
  await writeFile(join(output, 'feed.xml'), rss);
} finally {
  await rm(temp, { recursive: true, force: true });
}
