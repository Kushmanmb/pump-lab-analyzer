# pump-lab-analyzer
Independent Stake.us Pump seed analyzer featuring customizable client and server seed inputs, probability calculations, fairness verification, and historical pop analysis.

## Next Play Forecast

The **Forecast** tab shows the exact theoretical first-pop distribution over the 25 positions for Easy, Medium, Hard and Expert (survival, conditional pop risk, modeled payout of 0.98 / survival), plus a local-only audit log, nonce tracking and seed rotation.

**The exact next pop cannot be determined while the original server seed is hidden.** The SHA-256 hash is a commitment, not an input to any prediction. Probabilities are pre-round theory, and logged history is not a predictor.

## Development

`npm test` runs the math and page-structure tests (Node 18+, no dependencies). The site is static; `index.html`, `pump-math.js` and `forecast.js` are served as-is by GitHub Pages.
