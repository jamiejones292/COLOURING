# 🎨 Paintpot Pals — the magic colouring book

A free, ad-free colouring app for children that **always stays inside the lines**. Tap a space to fill it with colour, paint with brushes that can't go over the outlines, or turn your own drawings and photos into colouring pages.

It runs entirely in the browser, with no accounts, no tracking and no server. Saved pictures stay on the device they were made on.

---

## ✨ Features

| | |
|---|---|
| 🪣 **Magic Fill** | Tap any space and it fills up to the outlines. Plain, 🌈 rainbow or ✨ sparkle fills. |
| 🖌️ **Smart Paintbrush** | The brush only paints inside the space where the stroke started. Turn off *Stay in lines* to draw freely. |
| 🌈 **Rainbow & ✨ Glitter brushes** | Brushes that change colour as you paint, or leave sparkles. |
| 🦋 **Mirror mode** | Everything you do is copied to the other side, which suits butterflies, faces and castles. |
| ⭐ **Stickers** | 28 stickers to stamp onto finished pictures. |
| 📚 **37 original pages** | In 10 themes: animals, dinosaurs, princesses, vehicles, space, sea, unicorns, nature, farm and fantasy. |
| 📷 **Your own pictures** | Upload PNG / JPG / SVG / WEBP or take a photo. The lines are found automatically, with sliders for contrast, line sensitivity, thickness, speck clean-up and *Leak guard*. You can preview the colouring spaces before you start. |
| 🎨 **48-colour palette** | Plus a rainbow slider, a full colour picker and a 🎲 *Surprise colour* button. |
| ↩️ **Undo / redo** | Up to 60 steps, using little memory. |
| 🔍 **Zoom & pan** | Pinch, scroll wheel, the + / − buttons or the *Move* tool. |
| 💾 **My Masterpieces** | Saves automatically to the browser (IndexedDB), so children can come back to unfinished pictures. |
| 🖼️ **Download & print** | High-resolution PNG (3200 × 3200 for built-in pages) and a print view with only the picture. |
| 🎉 **Celebration** | Confetti and a cheer when a child taps *I'm done!* |
| 🌌 **Background themes** | Sunshine, Ocean, Meadow, Candy, Space and Plain. |

Works with mouse, touch and stylus on desktop, iPad, Android tablets and phones. The page doesn't scroll by accident while a child is colouring.

---

## 🧠 How "stay inside the lines" works

The outlines are kept on their own layer: black ink whose transparency is the darkness of the line. The colours go on a layer underneath. Region detection (`src/lib/regions.ts`) runs in a Web Worker:

1. Pixels darker than a threshold count as **walls**.
2. **Leak guard** (optional) thickens the walls by *N* pixels, which closes small gaps in hand-drawn lines.
3. A fast scanline flood fill **labels every enclosed space**.
4. Tiny specks (noise, anti-aliasing crumbs) are dropped.
5. A multi-source BFS gives **every remaining pixel**, including the line pixels themselves, to its nearest space. Fills therefore reach right under the outline, so anti-aliased edges never leave white halos, and the crisp outline is drawn on top.

* **Magic Fill** recolours every pixel with the label you tapped.
* **Smart Paintbrush** builds a mask of the starting space and clips each brush segment to it (`destination-in` compositing), so paint can't escape.
* **Undo** stores only the changed rectangle (before & after) of each action.

Uploaded pictures go through the same pipeline after conversion (`src/lib/imageProcessing.ts`):
* *Drawing* mode: soft threshold.
* *Photo* mode: blur, Sobel edges and an adaptive threshold with a floor, so sky gradients don't turn into stripes.
* *Keep as is*: the picture's own lines are used unchanged.

Photos rarely give perfectly closed shapes. The **Show colour spaces** preview shows exactly where colour would go, and a warning appears when very few spaces are found.

---

## 🛠️ Run it on your computer

You need [Node.js](https://nodejs.org) 18 or newer (20 recommended).

```bash
npm install
npm run dev        # open the printed http://localhost:5173 link
npm test           # unit tests for region detection & undo history
npm run build      # production build into ./dist
npm run preview    # serve the production build locally
```

---

## 🚀 Deploy to Netlify (free)

`netlify.toml` already sets the build command (`npm run build`), the publish folder (`dist`), the Node version and the cache headers, so there is nothing to configure.

### Option A: connect GitHub (recommended, updates automatically)

1. Push this project to a GitHub repository (it's already in one if you're reading this on GitHub).
2. Go to **[app.netlify.com](https://app.netlify.com)** and sign up or log in. Signing in with GitHub is easiest.
3. Click **Add new site → Import an existing project → GitHub**.
4. Choose the repository and the branch you want to publish (for example `main`).
5. Netlify reads `netlify.toml` and fills in **Build command `npm run build`** and **Publish directory `dist`**. Click **Deploy**.
6. After about a minute your site is live at an address like `https://random-name-123.netlify.app`.
7. Optional: **Site configuration → Change site name** gives you a nicer address, such as `https://paintpot-pals.netlify.app`. You can also add your own domain under **Domain management**.

### Option B: drag and drop (no GitHub needed)

1. Run `npm install` and then `npm run build` on your computer.
2. Go to **[app.netlify.com/drop](https://app.netlify.com/drop)**.
3. Drag the **`dist`** folder onto the page. It's live straight away.

### Option C: Netlify CLI

```bash
npm install -g netlify-cli
netlify login
netlify deploy --build          # preview link
netlify deploy --build --prod   # live site
```

---

## 🔄 Updating the app after deployment

* **With Option A:** edit the code, then `git commit` and `git push`. Netlify rebuilds and publishes automatically within a minute or two. Pull requests get their own *Deploy Preview* link for testing first. You can roll back to any earlier version under **Deploys** in the Netlify dashboard.
* **With Option B:** run `npm run build` again and drag the new `dist` folder onto your site's **Deploys** page.

Children's saved pictures are kept in their own browser, so updates never delete them.

### Adding your own colouring pages

Pages are SVG drawings in `src/data/pages.ts`. They use the helpers in `src/data/svgKit.ts`, drawn on a 600 × 600 grid. To add one:

1. Write the drawing, for example:
   ```ts
   const myPage = svg(c(300, 300, 150) + eye(260, 280, 12) + eye(340, 280, 12));
   ```
2. Add `{ id: 'my-page', title: 'My Page', category: 'animals', svg: myPage }` to `PAGES`.

Keep outlines closed and give shapes a white fill, so shapes in front hide the lines behind them. Use `clipped()` for stripes that must meet an edge exactly.

---

## 📁 Project structure

```
src/
  App.tsx                 hash router (works on any static host)
  screens/                Home, Gallery, Upload, Masterpieces, Workspace
  components/             toolbar, palette, modals, confetti, logo …
  data/pages.ts           the 37 built-in colouring pages
  data/svgKit.ts          SVG drawing helpers
  lib/engine.ts           colouring engine: layers, fill, smart brush, stickers, export
  lib/regions.ts          region detection (+ regions.worker.ts)
  lib/imageProcessing.ts  upload → line art conversion
  lib/history.ts          patch-based undo / redo
  lib/storage.ts          IndexedDB saving
tests/                    Vitest unit tests
netlify.toml              Netlify build & headers
```

## 🔒 Privacy

No ads, analytics, cookies, accounts or network requests. Fonts are bundled with the app. Uploaded pictures are processed on the device and never uploaded. Saved artwork lives only in that browser's storage.
