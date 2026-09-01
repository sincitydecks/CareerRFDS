# RFDS Careers — Vercel v21

Standalone Vercel deployment.

## Deploy
1. Push the contents of this folder to a GitHub repository.
2. Import the repository into Vercel.
3. Framework Preset: **Other**.
4. Add `FLIGHTAWARE_MAP_KEY` under Project Settings → Environment Variables.
5. Deploy.

The page calls `/api/flights` on the same deployment.

## v21 refinements
- Premium `JOIN THE FLYING DOCTOR` pill on the landing screen.
- Section-specific post-submit CTA labels.
- Rebalanced scrollytelling with a dedicated closing beat.
- Proof-point cards now resolve/dissolve against explicit story phases.
- Longer, even ending hold before the final interactive map.
- Scroll rendering throttled through `requestAnimationFrame` for smoother desktop/mobile motion.
- Mobile containment and centred map/story composition retained.

## FlightAware note
The current `/api/flights` implementation uses the existing FlightAware TV-map polling approach. If FlightAware returns HTTP 403 from its internal track-poll endpoint, the issue is upstream FlightAware access rather than Vercel routing.
