# Grace

Grace is a one-page site for collecting availability. A person adds their name, the days and times they can come, and an optional note. They do not have to stay for any set number of hours.

No account is required.

## Open it

https://matiyasmetek18-sketch.github.io/project_grace/

That address is the public site. Nothing needs to be installed.

## Run it locally

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

The Pages workflow installs dependencies, runs the tests and the type check, then builds the site with Node 22.

## What is saved

Answers live in one public list. Anyone who can open the site can read every answer and can currently remove any answer. Nothing is saved as a private copy on the device.

A person can add more than one day. Each day is added on its own. Sundays and Thursdays are not accepted, a day already on that person's list cannot be added again, and a day that has already passed is not accepted. The page shows where the times overlap.

## Limitations

Answers are stored in one public list. There are no accounts. Anyone using the site can see every answer and remove any answer, and the whole list could be wiped. Do not enter sensitive information.

## Stack

Vite, React, and TypeScript. Type is self-hosted Fraunces and Outfit.
