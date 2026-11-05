# Gavin Morgan's blog

A small static blog intended for `https://www.gavmor.com/blog/`. It uses [mdsite](https://benchristel.github.io/mdsite/) for the index and static files, and [marss](https://github.com/benchristel/marss) for Markdown rendering and the RSS feed. The build also creates an individual, shareable page for each post. Nothing in the diary is included or copied automatically. Only put material here that is approved for publication.

## Install, build, and preview

Requires Node.js 20 or later, npm, and Python 3 for the optional local server.

```sh
cd ~/Documents/blog
npm install
npm run build
npm run serve
```

Open <http://localhost:18765/>. The build recreates `dist/` from scratch, so do not keep hand-edited files there. It does not deploy anything. Individual pages are under `dist/posts/`, and the feed is at `dist/feed.xml`. Canonical URLs, social metadata, and feed links intentionally point to the public site rather than the local preview; navigation and assets work in either location.

## Write a post

Edit `src/index.md`. Add each post as a level-two heading with a unique date and title, newest first; its body continues until the next level-two heading. Add a unique, lowercase, hyphenated slug comment immediately after the heading:

```markdown
## 2026-11-04: A title

<!-- slug: 2026-11-04-a-title -->

The text of the post goes here. Use **Markdown** as usual.

### A subheading

More text.
```

The slug determines the permanent URL, for example `https://www.gavmor.com/blog/posts/2026-11-04-a-title.html`. Choose it once and do not change it, even if you edit the title; changing it breaks existing links. Older posts without a slug comment use marss's heading ID, but explicit slugs keep URLs stable when titles change. Duplicate or invalid slugs fail the build. Existing index heading anchors remain available.

Use level-three headings for subsections, since marss treats every level-two heading as a separate feed item. Dates in `YYYY-MM-DD` format become RSS publication dates. Use absolute URLs for links and images in posts so they also work on individual pages and in feed readers. Keep the `@marss` metadata comment: it sets the feed title, description, and public URLs. If the canonical hostname or path changes, update both URLs there, retaining the trailing slash on `htmlUrl`. The first paragraph supplies each page's social description. Rebuild after editing.

`src/style.css` controls the appearance; `template.html` contains the page shell and RSS discovery link. Other files placed under `src/` are passed through mdsite as static assets, subject to its file handling. The generated pages use relative navigation and asset links for the `/blog/` base path.

## Publishing

Push to `main` in the `gavmor/blog` repository to build and deploy via GitHub Actions. GitHub Pages serves this project at `/blog/` under the existing user site's custom domain. Review posts for private material before pushing; never publish diary entries without explicit permission.
