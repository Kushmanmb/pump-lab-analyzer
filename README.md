# Pump Lab — Seed Analyzer

A mobile-first, dark, client-side dashboard (original branding) for analysing and verifying Pump-style provably fair rounds. Plain HTML/CSS/JS; no build step, no network calls, works on iPhone Safari.

**Live site (after deploying):** `https://kushmanmb.github.io/pump-lab-analyzer/`

## Important
- Probabilities are **mathematics, not predictions**. Each round is independent and uniformly random.
- A **hashed server seed cannot reveal future pop positions**. Positions can only be computed after the server seed is revealed (seed rotation), i.e. for *past* rounds.
- The app does not place wagers and never connects to any gambling account. Seeds and history are stored only in your browser's `localStorage`.

## Features
Editable active/next client seed and server-seed hash, rotation tracking, Easy/Medium/Hard/Expert (1/3/5/10 pops), 25-position probability calculator (per-pump, exact-pump and cumulative risk), SHA-256 seed-hash verification, historical pop verification, nonce input and history log, JSON export, clear-all.

## Algorithm (js/pumpfair.js)
Implemented from Stake's published provably-fair scheme (byte generator → floats → Fisher–Yates-style selection, as used for Mines-type games):
1. Bytes: `HMAC_SHA256(key = serverSeed, msg = "clientSeed:nonce:round")`, 32 bytes per round, round = 0,1,2…
2. Floats: each 4 bytes → `Σ byte_i / 256^(i+1)`.
3. Positions 0–24 are drawn without replacement: step *i* takes index `floor(float_i × (25 − i))` of the remaining list.
4. The first *N* drawn positions are pops (N = 1/3/5/10); the balloon pops at the lowest of them (shown 1-based).

Note: the official page could not be fetched from the build sandbox, so step 3–4 follow the publicly documented description and should be cross-checked against Stake's own verifier with one of your real rounds before relying on it. SHA-256/HMAC are verified against NIST/RFC 4231 vectors and Node's `crypto`.

Probability of surviving *k* pumps with *N* pops: `C(25−k, N) / C(25, N)`.

## Develop / test
```
npm run check
npm test        # Node 18+; no dependencies
```
Open `index.html` directly or serve the folder with any static server.

## Deploy
1. Push to `main` (merge the PR).
2. Repo **Settings → Pages → Source: GitHub Actions** (one-time).
3. `.github/workflows/pages.yml` runs the tests and publishes automatically; the URL appears in the workflow run and above.
