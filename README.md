# Grace

Grace is a one-page site for collecting availability. A person adds their name, the days and times they can come, and an optional note. They do not have to stay for any set number of hours.

No account is required.

## Open it

https://matiyasmetek18-sketch.github.io/project_grace/

That address is the public site. Nothing needs to be installed.

## Run it locally

Node.js must match `^20.19.0 || ^22.13.0 || >=24.0.0`. Tests use jsdom 29, which allows Node 20.19 and Node 22.13. CI runs the suite on Node 20 and Node 22.

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

The Pages workflow installs dependencies, runs the tests, then builds the site. Building already type-checks. CI on a pull request runs the tests, the type check, and the build. Neither workflow deploys from a pull request.

## What is saved

Answers live in one public list. Anyone who can open the site can read every answer. Nothing is saved as a private copy on the device.

You can remove an answer after you confirm, when the shared list has given that answer an id. The page asks before it removes anyone. An answer the list has not identified cannot be removed from here.

A person can add more than one day. Each day is added on its own. Sundays and Thursdays are not accepted, and those days are left off when the list is shown. An answer that has only Sunday or Thursday ranges is hidden here, but it is still stored in the public list. A day already on your own list cannot be added again. A day that has already passed cannot be added. An answer that is already on the list for a past day stays visible. The page shows where the times overlap.

## Limitations

Answers are stored in one public list. There are no accounts. Anyone using the site can see every answer and remove any answer that is on the list, and the whole list could be wiped. Do not enter sensitive information.

The public list does not add its own clock. This page uses the time sent with the answer. A time up to 7 days ahead is still shown and counted, so a clock that is about a day fast or slow does not hide a real answer. A time further ahead than that, such as the year 9999, stays in the list but is sorted after real answers and is not counted in the common times. An answer that has only Sunday or Thursday ranges is hidden on this page and is still stored publicly. An answer that has been sent but not confirmed yet is marked “Not confirmed yet” and is not counted in the common times. You can check the list again from that message.

## Stack

Vite, React, and TypeScript. Type is self-hosted Fraunces and Outfit.
