# Zeta Desktop Skin

A desktop layout for [zeta-ai.io](https://zeta-ai.io). It changes nothing on Zeta's side and only restyles the page in your own browser.

- Zeta's bottom nav becomes a rail on the left
- The feed widens to fill the screen
- Grey/black palette with a quiet Three.js particle background
- Text size control (100 to 145%) in the rail, remembered per browser
- Chat pages keep a readable column in the middle
- A Full / Calm / Off switch controls the background, and the animation pauses in background tabs

It only switches on when the window is at least 1100px wide. Narrower windows get Zeta's normal view.

## Install (Zen, Firefox or Chrome, with Tampermonkey)

1. Install the Tampermonkey extension.
2. Open the raw [`zeta-reskin.user.js`](zeta-reskin.user.js) file. Tampermonkey will offer to install it.
3. Updates arrive on their own. To pull one right away, open the Tampermonkey dashboard and choose "Check for userscript updates".

## Chrome extension (optional)

`extension/` holds the same skin as an unpacked Chrome extension. Load it from `chrome://extensions` with "Load unpacked". It reloads itself when its files change.

`extension/skin.js` is generated from `zeta-reskin.user.js`, so edit the userscript first.

## Files

- `zeta-reskin.user.js`: the skin
- `extension/`: the same skin packaged as an extension, plus a local copy of Three.js r128 (MIT)
- `docs/prototype.html`: the original layout mock-up
