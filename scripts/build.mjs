import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

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

try {
  await cp(join(root, 'src'), input, { recursive: true });
  const fragment = join(temp, 'index.html');
  const feed = join(temp, 'feed.xml');
  run('marss/dist/main.js', [join(root, 'src/index.md'), feed, fragment]);

  // Render the same HTML that marss used to create item anchors.
  await writeFile(join(input, 'index.md'), await readFile(fragment));
  await rm(output, { recursive: true, force: true });
  run('@benchristel/mdsite/dist/main.js', ['-i', input, '-o', output, '-t', join(root, 'template.html')]);
  await cp(feed, join(output, 'feed.xml'));
} finally {
  await rm(temp, { recursive: true, force: true });
}
