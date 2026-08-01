# BLACKBOX by NovaShield — Static Site

Complete standalone HTML/CSS/JS export of the BLACKBOX web app.

## Files
- `index.html` — Animated landing page
- `onboarding.html` — Rider onboarding form
- `dashboard.html` — Live telemetry dashboard
- `styles.css` — All styling (glassmorphism, neon theme, animations)
- `app.js` — Interactivity, local storage, canvas charts, live event log

## Run
Open `index.html` directly in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000.

## Notes
- Background video is streamed from the Lovable CDN (works with internet).
  To go fully offline, download the video and change the `<video src="...">`
  in each HTML file to a local path.
- Charts are rendered on `<canvas>` — no chart library needed.

Developed by NovaShield · Team Mayank · Angel · Diksha · Ketan · PIET
