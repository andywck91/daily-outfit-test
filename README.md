# Daily Outfit (test build)

Picks today's outfit from the clothes a person already owns: top/bottom or dress, layer, shoes, bag, jewelry, plus a hair and makeup suggestion and a drawn picture of each look. Three alternatives per request. A clothing item is not offered again within the last **N** outfits (default 10, adjustable, per category).

English first, 中文 with one tap. Built for Android phones; first test group is in Malaysia (hot and humid default, air-con toggle, a Festive occasion for Raya / CNY / Deepavali).

## What works (tested)

| Area | Status |
|---|---|
| No-repeat rule (N, per-category switches, laundry, "resting" countdown) | 16 automated tests, including the same maths as `Wardrobe_Planner.xlsx` |
| 3 diverse looks per occasion, weather and air-con aware | tested |
| Wardrobe: add by camera/gallery photo, edit, laundry, delete | tested in a phone-sized browser |
| Import the Excel template (Wardrobe sheet saved as CSV), export CSV, JSON backup | import and CSV export tested; JSON export/restore built, not click-tested |
| Gap check + optional shopping ideas | tested |
| Wardrobe runs dry → explains why and offers a smaller N | tested |
| Data kept on the phone (IndexedDB), survives reload | tested |
| Illustrations drawn on the phone from the items' colours and styles | visually checked |

Run the checks: `npm test` (rules) and, with Playwright installed, `node tests/e2e.cjs` (full phone flow; needs `CSV=` and `PHOTO=` file paths, see the top of the file).

## What is NOT verified or not built

- **No APK was compiled.** The build environment could not download the Android SDK. The Capacitor project and GitHub Actions workflow below are written but **have not been run**. Expect to fix small things on the first build.
- **Live weather is untested against the real service.** Tests use a mocked Open-Meteo reply in its documented shape. Check it once on a real phone with location on.
- The app cannot read the phone's built-in weather app (no web or Android WebView API for that). It asks for location, rounds it to about 1 km, and asks Open-Meteo. If location is refused, the user picks the weather by hand.
- **Illustrations are flat vector drawings, not photos and not AI images.** They do not use the user's photo: skin tone, hair colour and length are chosen in Settings. A photo-based try-on is a later phase.
- Photo upload picks the **dominant colour** automatically. Category and style are chosen by the user (no clothing recognition yet).
- File downloads (backup / CSV export) work in Chrome. Inside the Capacitor app they may need the Filesystem/Share plugin.
- No accounts, no sync between phones, no payments (test stage).

## Try it on an Android phone without an APK

1. Put the `www/` folder on any HTTPS host (GitHub Pages, Netlify, Cloudflare Pages).
2. Open the address in Chrome on the phone → menu → **Add to Home screen** (or the Install button in the app's Settings tab).
3. It then opens full-screen like an app and works offline.

Local preview: `npm run serve` then open http://localhost:8080 (localhost counts as secure, so location and camera work).

## Building the APK (untested)

On GitHub: push this folder to a repository and run the **Build Android debug APK** workflow (Actions tab). It runs the tests, creates the Android project with Capacitor, adds the location and camera permissions (`scripts/patch_manifest.py`), builds `app-debug.apk` and attaches it to the run. Testers install it by opening the file on the phone and allowing "install unknown apps".

On a PC with Android Studio: `npm install`, `npm run android:add`, open the `android/` folder in Android Studio, Build → Build APK.

A debug APK is fine for a small test group. A Play Store release needs a release signing key and store listing, which is out of scope here.

## Files

```
www/            the app (no build step)
  js/engine.js      rules, recommendations, CSV, gap check
  js/illustration.js  drawing of each look
  js/app.js         screens and events
  js/i18n.js        English + 中文 text
  js/store.js       IndexedDB storage
  js/weather.js     location + Open-Meteo
  js/demo.js        43-item demo wardrobe
tests/          engine tests + phone-sized end-to-end test
scripts/        Android manifest patch
```

## Privacy

Everything is stored on the phone. Photos never leave it. The only network call is the weather request, which carries approximate coordinates and nothing else.
