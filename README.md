# Grace

Grace is a small web app for community gatherings. People share the days and hours they can come, and the tasks or rooms they can take on. The page shows where those hours overlap, and where hands are drawn.

The first gathering is a pre-winter work day on the grounds: outdoor jobs before the freeze. A second, clearly labeled sample gathering shows the same tools used for an evening planning meet-up. You can also add a gathering of your own in this browser.

No account is required. The host's name, phone number, and email are not on the page, because none were provided.

## Open it

https://matiyasmetek18-sketch.github.io/project_grace/

That address is the public site. Nothing needs to be installed. A refresh on a gathering link stays on Grace, because GitHub Pages serves the app for unknown paths.

## Run it locally

You need Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:5173/project_grace/ — the dev server uses the same `/project_grace/` base path as the public site.

Other commands:

```bash
npm test
npm run typecheck
npm run build
npm run preview
```

`npm run build` writes a static site to `dist/`. `npm run preview` serves that build.

## What is saved

Grace keeps what you add in **this browser only**, under the localStorage key `grace.store.v1`. A refresh keeps it. Nothing is sent to a server, so another phone or another person has a separate copy. That is a limit of this first version.

Saved on this device:

- Hours and notes you submit
- Gatherings you create
- Tasks you mark done or waiting on the season
- Whether example people are hidden

The footer action **Clear this browser** removes those additions and brings the examples back. The two original gatherings stay, because they ship with the app.

## Example people

The charts are filled, on a first visit, with people marked **Example** (Sam, Elena, Marcus, Amina, and Chris on the work day; Jonah, Ruth, Luis, and Nora on the sample evening). They are sample data, not neighbors. Hide them from the people section when you want the picture to show only hours saved in this browser.

## The work day

**Before the ground freezes** runs November 14 through December 6, 2026, between 8:00 AM and 4:00 PM. Tasks are grouped by area of the grounds: greenbelts, the north yard, the rental house and parking, platforms, the orchard, the carport, berry beds, pots, and the south side. The weed wacker still needs line. Heavier tasks are marked so people can see where extra strength helps.

With the example people visible, the strongest shared block is Saturday, November 21, 10:00 AM–12:00 PM.

## Stack

Vite, React, and TypeScript. Type is self-hosted Fraunces and Outfit. Overlap math lives in `src/lib/overlap.ts` and is covered by `npm test`.
