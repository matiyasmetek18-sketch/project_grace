# Grace

Grace is a one-page site for collecting availability. A person adds their name, the days and times they can come, and an optional note. They do not have to stay for any set number of hours.

No account is required. No host name, phone, or email is shown.

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

Grace keeps what you add in **this browser only**, under the localStorage key `grace.availability.v1`. A refresh keeps it. Nothing is sent to a server, so another phone has its own copy. People add one day at a time. Sundays are not accepted, and a day already on the list cannot be added again.

Saved on this device:

- The name you enter
- The days and times you add
- An optional note

## Stack

Vite, React, and TypeScript. Type is self-hosted Fraunces and Outfit.
