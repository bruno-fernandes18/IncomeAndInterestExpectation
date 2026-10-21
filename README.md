# Income & Interest

A compound-interest calculator for recurring investments. The responsive site is served by Express, and the projection is calculated by the Node.js server.

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

## Architecture

The project is a small JavaScript modular monolith. Its calculation core is framework independent, and the Express route is the HTTP adapter around that core. The browser is composed from calculator and example features, with small ViewModels coordinating state and presentation components rendering results.

See [ARCHITECTURE.md](ARCHITECTURE.md) for module boundaries and the calculation contract. Run the built-in Node.js tests with `npm test`.

## Projection assumptions

- The starting balance is R$0.00, before the first monthly contribution.
- A yearly income amount is divided into twelve equal monthly contributions.
- The chart keeps monthly points for hover inspection. Monthly rates credit interest every month; annual rates credit interest every twelve months. Monthly contributions are added after each interest tick, so the newest contribution does not earn interest at that tick.
- An annual rate is used as entered at each yearly tick. Its monthly equivalent is calculated only for the educational rate insight, not for the annual projection itself.
- The growth percentage compares estimated interest with total contributions: `(ending portfolio - total contributions) / total contributions × 100`. A percentage change from a zero starting balance is undefined.
- The future projection continues the same monthly contribution and interest rate for a randomly selected 2 to 10 units of the chosen time unit whenever an input changes.
- The maximum projection period is 100 years. Projections exclude taxes, fees, and inflation.
- The Example page derives its values from the first 50 digits of pi, cycling the multipliers `100`, `75`, `100`, and `50`, then types each field gradually while its yellow Windows-style arrow follows the measured movement speed.

## Localization

The interface supports English, Simplified Chinese, Hindi, Spanish, Modern Standard Arabic, French, Bengali, Portuguese, Indonesian, and Urdu. Currency formatting follows the selected locale: USD, CNY, INR, MXN, SAR, EUR, BDT, BRL, IDR, or PKR, respectively. These are representative currency choices for each language locale; several languages are used across countries with different currencies. Keep translation identifiers aligned across every JSON file in `public/locales/`. The header and language selector stay available while Home, How it's calculated, and Example replace the main view.
