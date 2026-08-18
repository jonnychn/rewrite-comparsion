# Redline

A private, browser-only tool for comparing a piece of writing with its rewrite.
Paste the original on the left and the updated version on the right, and every
word that was cut, added, or reworked is marked in place.

Black and white, Notion-inspired, no build step, no account, no network calls.

## Running it

`index.html` is fully self-contained — CSS and JavaScript are inlined, so
there are no sibling files to fetch. Double-click it, drop it on a static
host, or open it from anywhere; it works offline and over `file://`.

To change the tool, edit the files in `src/` and rebuild:

```bash
node build.js    # regenerates index.html from src/
```

## What it does

- **Line-by-line alignment.** Lines are matched with an LCS pass; a removed
  line and an added line that still resemble each other are paired into a
  single "reworked" row instead of showing up as an unrelated cut and paste.
- **Word-level marks inside a reworked line.** Cuts are struck through in grey,
  additions are highlighted and underlined in black. Whole lines that were
  removed or added get a gutter mark (`−`, `+`, `~`) and a side bar.
- **Two layouts.** Side by side (original left, rewrite right) or stacked
  (each change reads top to bottom). Narrow screens always stack.
- **Compare by word or character**, and optionally ignore capitalisation,
  punctuation, or unchanged lines.
- **Summary panel** — words added, words removed, lines touched, and how much
  of the original wording survived.
- **Change navigation** with the arrows in the header, or `J` / `K`.
  `⌘/Ctrl + Enter` toggles between writing and the diff.
- **Copy report** puts a plain-text `-` / `+` version of the comparison on the
  clipboard, which pastes cleanly into email or a doc.
- **Load demo** fills both sides with sample copy (a generic essay-shaped
  paragraph and its feed-post rewrite) so a first-time visitor sees what the
  marks mean. The demo loads by default and is sample text only.

## Files

| File | What's in it |
| --- | --- |
| `index.html` | **The build output.** Self-contained page — do not edit by hand |
| `src/index.template.html` | Page structure: hero, editor/diff canvas, control panel |
| `src/styles.css` | All styling, including the diff marks and the responsive rules |
| `src/diff.js` | The diff engine — pure functions, no DOM, usable on its own |
| `src/app.js` | UI wiring, demo copy, stats, navigation, clipboard |
| `build.js` | Inlines `src/` into `index.html` |

`diff.js` exposes `Redline.compare(original, updated, options)` and returns
aligned rows plus a stats object, so it can be reused headlessly:

```js
const { rows, stats } = Redline.compare(a, b, { granularity: 'word' });
```

## Privacy

Text never leaves the browser. There is no analytics, no storage, and no
network request beyond the optional web font, which the page renders fine
without.
