---
type: decision
tags: [nbc, design, architecture]
created: 2026-09-08
updated: 2026-09-08
---

# Design and technical decisions

Parent: [[00-Implementation-Index]]

## Accepted visual direction

The user selected **Contemporary Heritage**, then selected **balanced editorial** motion. This supersedes the earlier research preference for the Institutional Reading Room concept.

The visual system uses limestone/cream surfaces, olive text, copper accents, Noto Naskh Arabic for editorial headings and reading, and Noto Sans Arabic for controls and body copy. Fonts are bundled locally, avoiding runtime font-service requests. Organizer branding and formal design-system applicability remain pending.

Motion emphasizes entrances, selection feedback, layout adaptation, and save status. Normal scrolling remains intact. Motion's user reduced-motion setting and CSS reduced-motion rules suppress nonessential movement. Automatic save acknowledgements appear only after the server confirms persistence.

## Architecture and boundaries

- Next.js App Router with TypeScript; small client components handle interaction, while database operations and authorization live on the server.
- PGlite provides a local embedded PostgreSQL engine. A single process owns each data directory. It is a demonstration adaptation of the planned PostgreSQL architecture, not a production hosting choice.
- Server-generated opaque sessions are stored as hashes, expire after eight hours, and use HTTP-only SameSite cookies. Explicit demo staff entry is local and synthetic-only.
- Questions are copied into an attempt when it starts. Only a projection without answer keys is sent to participant clients.
- Revision checks reject conflicting saves. Submission runs in a transaction and subsequent retries return the existing receipt.
- Every new final submission withdraws existing grade publication pending review. Grade publication does not resolve ties or select winners.
- OTP simulation is confined to the demo authentication module; real identity/SMS provider adapters remain to be implemented.

## Current library evidence

The installed versions are pinned in `package.json` and `package-lock.json`. Technical choices were checked using Context7 against the following primary documentation:

- [Next.js server and client components](https://nextjs.org/docs/app/getting-started/server-and-client-components).
- [Next.js data security](https://nextjs.org/docs/app/guides/data-security).
- [Motion accessibility](https://motion.dev/docs/react-accessibility).
- [PGlite API and backup facilities](https://pglite.dev/docs/api).

## Image provenance

The homepage asset is `public/images/heritage-book.png`, generated with the built-in image-generation tool. It is original concept artwork, not a photograph of a verified historic landmark or the approved book. No official seals or logos were used.

Final prompt:

> Create a premium editorial website hero photograph / architectural still life for an Arabic national belonging reading competition, contemporary Saudi heritage art direction. Landscape 3:2. No text, no letters, no logos, no UI, no watermark, no flags. A beautiful open book with blank softly textured cream pages in foreground on a limestone plinth, to the left middle, bathed in natural warm morning light. Behind: sculptural sand plaster courtyard arch and stepped earth architecture, restrained dark olive branches casting intricate soft shadows from upper left. Rich sophisticated depth, tactile limestone and paper, natural beige/sand/olive/copper palette, refined museum exhibition photography. Composition full scene across frame; right quarter softly lit bare plaster blending naturally into warm cream background, ample architectural negative space, no people, no invented authentic landmark. Fine-grained high detail, believable sunlight, calm intelligent welcoming feeling. This will be an actual website illustration, not a website screenshot.

The earlier four comparison mockups were planning previews. The implemented interface is real HTML/CSS, not a flattened screenshot.
