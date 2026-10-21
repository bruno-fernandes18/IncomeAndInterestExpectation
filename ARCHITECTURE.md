# Architecture

The application uses feature-based organization, a light MVVM split in the browser, and a functional core behind an imperative shell. It stays a single Node.js process with no framework, database, account system, or server-side user state.

## Module map

```text
domain/interest/                 Pure calculation and input rules
server/routes/simulate.js        HTTP adapter for the calculation core
shared/finance/                  Financial constants shared with the browser
public/app.js                    Browser composition root
public/features/calculator/      Calculator client, ViewModel, and components
public/features/example/         Automated example routine and its configuration
public/features/navigation/      View navigation and example lifecycle
public/shared/formatting/         Locale aware number and currency formatting
public/shared/i18n/              Locale metadata, catalogs, and document rendering
public/locales/                  Translation catalogs
tests/domain/                    Deterministic calculation contract tests
```

`domain/interest` does not import Express, browser APIs, localization, or the example routine. It accepts plain input, validates it, and returns plain result data. The HTTP route translates domain errors into status codes and stable error identifiers. `server.js` only configures the app, static files, API route, and LAN listener.

The browser entry point wires the feature modules together. `CalculatorViewModel` owns form request state and emits success/error/loading changes. The chart keeps its own model and ViewModel; chart, summary, and insight components only render provided state. The example routine has its own configuration and timing logic. Locale lookup is separate from numeric/currency formatting, and neither changes the mathematical input.

## Calculation contract

- The starting balance is zero. Each monthly contribution is added after any interest tick in that month.
- A monthly rate compounds on every month. An annual rate compounds every twelve months using the entered annual rate.
- The final contribution earns no interest after the selected period ends.
- The timeline always contains monthly points, including when the selected rate is annual.
- Summary money is rounded to cents at the output boundary. Timeline balances retain calculation precision for chart inspection.
- The returned equivalent monthly rate for an annual rate is informational; it does not change the annual compounding schedule.

These rules are covered by the Node.js built-in test runner. Input validation remains at the domain boundary because requests can be constructed outside the browser.

## Deliberate scope

The project uses JavaScript modules with JSDoc at domain boundaries and runtime validation for external input. There is one calculation algorithm, so it remains a pure function instead of a Strategy class hierarchy. The demo has no external AI provider or secret key; its instructions and generated values are local and deterministic where the configured sequence applies. New adapters, storage, decimal libraries, or infrastructure should be introduced when a concrete requirement needs them.
