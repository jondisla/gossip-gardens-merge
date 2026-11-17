# Gossip Gardens

A mobile merge game made as a personal, non-commercial project. Tap generators to make items, drag matching
items together to level them up, serve customers, and restore a run-down manor.

It is plain HTML, CSS and JavaScript. No build step, no dependencies, no accounts, no network.

## Play

**Online:** https://jondisla.github.io/gossip-gardens-merge/ (works on a phone; use "Add to Home Screen" to install it).

**On your computer:** open **`gossip-gardens/index.html`** in a browser (double-click it). Progress saves in the browser.

To try it on a phone on the same Wi-Fi, run **`gossip-gardens/serve.bat`** and open the address it prints.
More detail, controls and the file map are in [`gossip-gardens/README.md`](gossip-gardens/README.md).

## Tests

```
cd gossip-gardens
node --test tests/*.test.js
```

Needs Node 18 or newer. The game itself does not need Node.

## What is here

| Path | What it is |
|---|---|
| `gossip-gardens/` | The game: `index.html`, `js/`, `style.css`, `art/`, `tests/` |
| `DESIGN.md` | Design notes: merge rules, item chains, generators, screens |
| `tools/` | Small helper scripts used while building (image cutting, asset sorting, image generation) |

## Art and credits

The images in `gossip-gardens/art/` were made by the project owner with AI image tools. Item, character and scene names are
original to this project. Screenshots and files from other games were used only as private reference and are **not** included
in this repository.

This is an unofficial hobby project. It is not affiliated with or endorsed by any other game or company.
No license has been chosen, so by default nothing here is licensed for reuse. The code and art are public to look at and play.
