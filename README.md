# MallVerse

A three-floor 3D shopping mall in the browser, explored as a third-person avatar. Visitors start on the plaza, create an avatar, fly in through the glass entrance and walk a connected building:

- **Level 1, Fashion & Lifestyle:** the skylit atrium with the spiral fountain sculpture, two shopping wings and four stores.
- **Level 2, Technology & Entertainment:** gallery ring, Lumen and the Pixel Forge arcade.
- **Level 3, Food & Leisure:** dining terrace, Atrium Roasters, and the Saffron Table and Umami Street restaurants.

The floors are linked by two working escalators and a glass lift that physically carry the avatar. Products can be inspected, configured in 3D and added to a demo bag. There is a bilingual (Arabic/English) shopping assistant, optional live presence of other visitors, and day/evening/night lighting.

Built with Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS 4, three.js, React Three Fiber, drei, @react-three/postprocessing, GSAP, Zustand, Socket.IO and the Anthropic SDK.

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm start          # serve the production build
npm test           # unit tests (vitest)
npm run lint
npm run realtime   # optional multiplayer presence server (port 3001)
```

The mall works with no environment variables. Two optional services add features:

| Variable | Where | Enables |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Next server only (never sent to the browser) | AI shopping assistant. Without it the assistant answers from an offline directory search and says so. |
| `NEXT_PUBLIC_REALTIME_URL` | Build time, e.g. `http://localhost:3001` | Live presence. Without it the HUD shows a solo session. |
| `REALTIME_PORT`, `REALTIME_ALLOWED_ORIGINS` | Realtime server | Port (default 3001) and CORS origins (default `http://localhost:3000`) |

Multiplayer locally:

```bash
npm run realtime                                          # terminal 1
NEXT_PUBLIC_REALTIME_URL=http://localhost:3001 npm run dev  # terminal 2, open two browsers
```

Fonts are self-hosted by `next/font`. Every texture, sign, avatar and sound is generated at runtime, so there are no downloadable 3D or image assets.

## Controls

| Action | Desktop | Touch |
| --- | --- | --- |
| Walk / run | `W A S D` / arrows (`Shift` to run) | Left joystick |
| Orbit camera | Drag the scene | Drag anywhere |
| Zoom camera | Mouse wheel | Pinch |
| Third / first person | `V` | Settings |
| Enter store / inspect / call lift | `E` or click it | Tap the prompt |
| Choose lift floor (inside the cabin) | `1`–`3` or the floor panel | Floor panel |
| Map & directory | `M` | Map button / minimap |
| Back / close | `Esc` | Close buttons |

Visitors who don't want to steer can open the directory and pick a store on any floor, then choose:

- **Show route:** a 3D line and map route, updated as you move, with step-by-step instructions.
- **Walk me there:** the autopilot walks, rides the escalator or takes the lift.
- **Fast travel**

**Browse products** is a keyboard- and screen-reader-friendly catalogue that also works without WebGL.

## Features

- **Entry flow:** intro establishing shot, then the avatar creator, then the entrance flight that lands behind the avatar in the atrium. "Skip intro" is available at every step.
- **Avatars:**
  - Four presets plus build, height, skin tone, hairstyle, hair colour, top, colours, shoes, an accessory and a display name.
  - Saved in `localStorage` and editable later from the HUD.
  - The body is a procedural articulated figure with blended idle, walk and run, turn lean, an interaction reach and a riding stance.
- **Third-person camera:**
  - Spring-arm boom that retracts when walls or ceilings get in the way, plus orbit and zoom.
  - First-person toggle.
- **Vertical transport:**
  - Escalators A (L1↔L2) and B (L2↔L3) carry the avatar along the incline.
  - The glass lift runs a deterministic state machine (`lib/elevator.ts`): call queue, door cycle, trapezoidal motion. The avatar stands in the cabin while it moves.
- **Navigation:**
  - A directed multi-floor graph with Dijkstra routing that produces legs (walk / escalator / lift).
  - Per-floor minimap and directory map show the route and transfer points.
  - The route refreshes as the visitor moves, with an arrival toast.
- **Lighting modes:**
  - Day, evening and night blend smoothly: sun, sky dome with stars, fog, emissive fixtures and light pools.
  - The frozen shadow map is re-rendered during the transition.
- **3D configurator:**
  - The Arc Runner sneaker has upper colour, upper material (with price deltas), sole and laces, applied live to the 3D model.
  - The cart stores the configuration and its unit price, and rejects invalid combinations.
- **Shopping assistant** (`/api/assistant`):
  - Claude (`claude-opus-5-5`) with server-side fallback models enabled.
  - Strict tool calls over the real mall data: store search, product search, directions, start navigation, nearest facility, floor overview.
  - Replies in the visitor's language (Arabic or English) and can start guided navigation.
  - Rate-limited per IP; inputs and positions are validated on the server.
  - Without a key, a labelled offline matcher answers common questions in both languages.
- **Live presence:**
  - Socket.IO server with protocol validation, token-bucket rate limits and movement plausibility checks.
  - Area-of-interest filtering, 10 Hz snapshots, 120 ms interpolation on the client, reconnection, and name tags.
  - The HUD shows the connection state honestly.

## Architecture

```
server/realtime/       Socket.IO presence server (Node 24 runs the TypeScript directly)
src/
  app/                 layout, page, design tokens; api/assistant (POST, server-only)
  server/ai/           assistant prompt, tools and tool loop (server-only)
  components/          HTML UI only, no three.js imports
    MallExperience     orchestrator: hydration, WebGL check, lazy 3D chunk, presence, overlays
    avatar/            avatar creator
    assistant/         assistant chat panel
    layout/            HUD (lift panel, lighting, presence), intro, loading, settings & help
    navigation/        per-floor SVG map, minimap, directory with routes
    products/          product panel, details and configurator controls
    shopping/          cart drawer (demo checkout)
    stores/            accessible store catalogue
  data/                single source of truth, plain TypeScript
    floors.ts          floor heights and themes
    layout.ts          per-floor walkable areas, voids, bridges, escalators, lift, zones, collision
    stores.ts          nine fictional brands across three floors
    storeLayouts.ts    interior fixtures (as obstacles) and product slots
    navigation.ts      multi-floor wayfinding graph, destinations, interactables
    products.ts        SAMPLE catalogue (clearly marked demo data)
    configurators.ts   configurable products, options and price deltas
    avatars.ts         avatar presets, palettes and sanitising
  features/
    exploration/       actions (enter, navigate, fast travel, lift, inspect) + opt-in debug hook
    multiplayer/       shared protocol validation + client (presence store, interpolation)
    ai-assistant/      mall knowledge queries, offline bilingual matcher, shared types
  lib/                 collision, pathfinding, transit geometry, elevator, runtime state, audio
  stores/              Zustand: experience, settings, cart, avatar (persisted where noted)
  three/
    scenes/            Canvas (renderer, adaptive DPR, post FX), world composition, perf probe
    architecture/      three-floor shell, escalators and lift, atrium, fountain, public spaces, exterior
    characters/        procedural avatar, player avatar, remote avatars
    stores/            config-driven storefronts and interiors (boutiques, arcade, restaurants)
    products/          procedural product models + interaction wrapper
    lighting/          lighting modes, sky dome
    camera/            GSAP camera director (intro, avatar framing, entrance flight, third person, inspect)
    controls/          input bindings, player controller (movement, rides, autopilot)
    interactions/      focus system, 3D route line
    materials/         procedural texture painters, shared material library
```

Key decisions:

- **One floor plan drives everything.** The 3D architecture, per-floor collision, camera space, maps, the wayfinding graph, the AI assistant's knowledge and the tests all read `data/`. Unit tests check that every nav edge is collision-free and that every store on every floor is reachable.
- **Movement, transport and camera are separate.**
  - `PlayerController` integrates input, autopilot legs and rides.
  - `lib/elevator.ts` is a pure, tested state machine.
  - `CameraDirector` owns the camera.
- **Per-frame state lives outside React** (`lib/runtime.ts`). Zustand only changes on meaningful events (zone, floor, focus, panel, route step).
- **Secrets stay on the server.** The Anthropic client is imported only from `server-only` modules. The browser bundle contains no key and no SDK.

## Rendering and performance

- **Procedural assets.** Materials are painted into canvases once at load, with real progress on the loading screen.
- **Draw calls.** Static architecture is merged per material, and repeated things are instanced. Measured: roughly 140–300 draw calls and 60k–145k triangles depending on the view.
- **Culling.** Store interiors render only within about 34 m and on or next to the visitor's floor. The exterior renders only near the entrance or during the intro.
- **Quality presets.**

  | Preset | DPR | Shadows | Textures | Post-processing |
  | --- | --- | --- | --- | --- |
  | Low (auto on touch devices) | ≤1 | None | 512 px | None |
  | Medium | ≤1.5 | 2048 px | 1024 px | None |
  | High | ≤2 | 4096 px | 1024 px | N8AO, bloom, ACES, MSAA |

  `PerformanceMonitor` adapts DPR within the preset and steps the preset down after sustained low frame rates. Settings → Performance overlay shows FPS, draw calls, triangles and GPU memory.

## Accessibility

- Keyboard access everywhere, with visible focus rings. Dialogs trap and restore focus, and `Esc` closes them.
- The lift floor panel, lighting switch, configurator and avatar options are real buttons and radio groups.
- Arabic text renders right-to-left (`dir="auto"`) in the assistant and in name tags.
- `prefers-reduced-motion` is honoured, with an in-app override. Under reduced motion, flights are skipped and directions teleport.
- A non-3D catalogue is always available, including when WebGL is missing or the context is lost.

## Visual references

The images in `public/references/` informed the art direction, which is modelled in 3D rather than used as backdrops:

| Reference | Used for |
| --- | --- |
| `ref-exterior-entrance.jpg` | Leaf-shaped glass canopy on branching columns, curtain walls, reflecting pool, ringed planter, palms |
| `ref-atrium-fountain.jpg` | Arched skylight, terrazzo, stacked-disc fountain, wood-clad escalators with glass balustrades, café parasols |
| `ref-luxury-storefront.jpg` | Maison Élan's stone-fin facade, display niches, marble with granite banding, brass-railed galleries |
| `ref-electronics-store.jpg` | Lumen's halo lights, device column, demo tables, light-box posters |
| `ref-sneaker-store.jpg` | Stride Atelier's plaster forms, cove-lit shelves, plinths, herringbone oak |

The brief also named `mall-atrium.png`, `mall-floors.png`, `mall-lighting.png`, `mall-navigation.png`, `avatar-character.png` and `product-customizer.png`. Those files were not supplied, so the upper floors, lighting modes, avatars and configurator follow the five references above and the written brief.

All brand names are fictional.

## Commerce

`data/products.ts` is sample data. The cart, including configured items, is a client-side demo persisted in `localStorage`. "Place demo order" produces a local reference number. No payment details are collected and nothing is sent anywhere.

## Testing

- **Unit tests** (`npm test`):
  - three-floor plan integrity, collision and per-floor walkability;
  - escalator and lift transit edges;
  - routing to every store on every floor;
  - lift state machine (queueing, doors, arrival);
  - cart maths and configuration validation;
  - realtime protocol validation and rate limiting;
  - assistant knowledge and the bilingual offline matcher.
- **End-to-end checks** were run against `npm start` in headless Edge, using the opt-in `/?debug` hook. They covered:
  - intro → avatar creator → entrance flight → atrium;
  - all three floors and their stores, escalator and lift rides by autopilot, and the lighting modes;
  - the configurator through to the bag, and the assistant in offline mode (Arabic and English);
  - two browsers connected through the realtime server, and the mobile viewport.

## Known limitations

- **Avatars** are procedural articulated figures, not rigged GLB characters with motion-captured animation. `three/characters/Avatar.tsx` takes an appearance and a motion source, so a GLB with an animation mixer can be swapped in behind the same interface.
- **All 3D content is procedural**, so products, furniture and people are stylised rather than photoreal.
- **Presence is in memory** on a single realtime process. Running several instances needs a shared adapter, such as Socket.IO's Redis adapter. The server validates and rate-limits movement but does not re-simulate it; flagged teleports (fast travel, lift arrival) are accepted subject to a cooldown and a walkable check. There are no accounts, chat or persistence; avatar and cart data stay in the visitor's browser.
- **The AI assistant** needs `ANTHROPIC_API_KEY`. The offline matcher covers common questions only.
- **Console warning:** React Three Fiber 9 logs a `THREE.Clock` deprecation warning from inside the library.
- **Audio** is procedural ambience plus UI chimes.
