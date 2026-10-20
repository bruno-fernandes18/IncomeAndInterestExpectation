# Income & Interest

A compound-interest calculator for monthly investments. The responsive English and Portuguese site is served by Express, and the projection is calculated by the Node.js server.

## Requirements

- Node.js 18 or newer
- npm

## Install and run

From the project directory, install the local dependencies and start the server:

```powershell
npm install
npm start
```

The server prints local and LAN addresses. It listens on `0.0.0.0`, so devices on the same local network can open the displayed LAN address if the firewall allows connections on the selected port (3000 by default).

To use a different port in PowerShell:

```powershell
$env:PORT = 3001
npm start
```

Dependencies are installed in this project’s ignored `node_modules/` directory. `package-lock.json` records the resolved dependency versions.

## Projection assumptions

- The starting balance is R$0.00, before the first monthly contribution.
- A yearly income amount is divided into twelve equal monthly contributions.
- Each month, the existing balance earns interest first; the new contribution is added afterward. The first contribution therefore earns for `months - 1` periods, and the final contribution earns no interest.
- Annual rates are treated as effective annual rates and converted to equivalent monthly rates: `(1 + annual rate)^(1/12) - 1`.
- The growth percentage compares estimated interest with total contributions: `(ending portfolio - total contributions) / total contributions × 100`. A percentage change from a zero starting balance is undefined.
- The future projection continues the same monthly contribution and interest rate for a randomly selected 2 to 10 units of the chosen time unit whenever an input changes.
- The maximum projection period is 100 years. Projections exclude taxes, fees, and inflation.

## Localization

All user-facing interface copy is keyed in `public/locales/en.json` and `public/locales/pt.json`. Add or update each text identifier in both files. The header and language selector stay available while Home, How it's calculated, and Example replace the main view.
