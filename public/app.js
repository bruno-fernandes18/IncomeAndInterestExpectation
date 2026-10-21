import { CalculatorClient } from './features/calculator/calculator-client.js';
import { CalculatorViewModel } from './features/calculator/calculator-view-model.js';
import { InvestmentChartViewModel } from './features/calculator/components/chart-view-model.js';
import { InvestmentChartView } from './features/calculator/components/growth-chart-view.js';
import { InvestmentResultsView } from './features/calculator/components/results-summary-view.js';
import { InvestmentInsightsView } from './features/calculator/components/insights-panel-view.js';
import { ExampleDemoController } from './features/example/example-demo-controller.js';
import { NavigationViewModel } from './features/navigation/navigation-view-model.js';
import { createNumberFormatters } from './shared/formatting/number-formatters.js';
import { LocalizationService } from './shared/i18n/localization-service.js';
import { applyLocalizedPage } from './shared/i18n/localized-page-view.js';

const form = document.querySelector('#simulation-form');
const submitButton = form.querySelector('button[type="submit"]');
const errorMessage = document.querySelector('#form-error');
const chartError = document.querySelector('#chart-error');
const chartElement = document.querySelector('#investment-chart');
const localeSelect = document.querySelector('#locale-switch');
const calculatorPanel = document.querySelector('#calculator-view');
const methodPanel = document.querySelector('#view-how');
const demoPill = document.querySelector('#demo-pill');

const localization = new LocalizationService();
const formatters = createNumberFormatters({
  getLocaleConfig: () => localization.config,
  text: (key) => localization.text(key),
  template: (key, values) => localization.template(key, values),
});

let latestResult = null;
let latestErrorKey = '';
let demoController = null;

const chartViewModel = new InvestmentChartViewModel();
const chartView = new InvestmentChartView(chartElement, chartViewModel, {
  currency: formatters.chartCurrency,
  fullCurrency: formatters.currency,
  compactCurrency: formatters.compactCurrency,
  percent: formatters.percent,
  axisMonth: formatters.axisMonth,
  pointMonth: (month) => localization.template('CHART_POINT_MONTH', {
    month: formatters.number(month),
    duration: formatters.timeAmount(month, 'months'),
  }),
  tooltipContributions: (point) => localization.template('CHART_TOOLTIP_CONTRIBUTIONS', {
    value: formatters.chartCurrency(point.contributions),
  }),
  tooltipInterest: (point) => localization.template('CHART_TOOLTIP_INTEREST', {
    value: formatters.chartCurrency(point.balance - point.contributions),
  }),
  chartAria: formatters.chartAria,
});

const resultsView = new InvestmentResultsView({
  initial: document.querySelector('#initial-patrimony'),
  contributions: document.querySelector('#total-contributions'),
  interest: document.querySelector('#interest-earned'),
  growth: document.querySelector('#growth-percent'),
  final: document.querySelector('#final-patrimony'),
  duration: document.querySelector('#duration-caption'),
  period: document.querySelector('#chart-period'),
}, {
  currency: formatters.currency,
  compactCurrency: formatters.compactCurrency,
  percent: formatters.percent,
  compactPercent: formatters.compactPercent,
  duration: formatters.timeAmount,
});

const insightsView = new InvestmentInsightsView({
  kicker: document.querySelector('.insight-kicker'),
  copy: document.querySelector('#did-you-know-copy'),
  count: document.querySelector('#insight-count'),
  next: document.querySelector('#insight-next'),
}, {
  percent: formatters.percent,
  currency: formatters.compactCurrency,
  unit: (amount, unit) => localization.text(
    `${unit === 'years' ? 'TIME_YEAR' : 'TIME_MONTH'}_${amount === 1 ? 'ONE' : 'OTHER'}`,
  ),
}, (key) => localization.text(key), (key, values) => localization.template(key, values));

function renderResult(result) {
  latestResult = result;
  resultsView.render(result);
  chartViewModel.setResult(result);
  insightsView.update(result);
}

function setError(errorKey) {
  latestErrorKey = !errorKey
    ? ''
    : localization.catalogs[localization.locale]?.[errorKey]
      ? errorKey
      : 'ERROR_NETWORK';
  const translatedError = latestErrorKey
    ? localization.text(latestErrorKey)
    : '';
  errorMessage.textContent = translatedError;
  errorMessage.hidden = !translatedError;
  chartError.hidden = true;
}

function setLoading(isLoading) {
  submitButton.disabled = isLoading;
  form.setAttribute('aria-busy', String(isLoading));
}

function applyLocale(locale) {
  localization.setLocale(locale);
  applyLocalizedPage({ documentRef: document, localeSelect, localization });
  if (latestResult) renderResult(latestResult);
  if (latestErrorKey) setError(latestErrorKey);
}

const calculatorViewModel = new CalculatorViewModel({
  form,
  client: new CalculatorClient(),
  onLoading: setLoading,
  onResult: (result) => {
    renderResult(result);
    demoController?.onCalculationResult(result);
  },
  onError: (errorKey) => {
    setError(errorKey);
    demoController?.onCalculationError();
  },
  isApplyingAutomatedInput: () => Boolean(demoController?.applyingValues),
});

localeSelect.addEventListener('change', () => {
  applyLocale(localeSelect.value);
  localStorage.setItem('incomeInterestLocale', localization.locale);
});

window.addEventListener('resize', () => {
  if (latestResult) resultsView.render(latestResult);
});

async function initialize() {
  try {
    await localization.load();
  } catch {
    // Embedded English strings remain readable when a catalog cannot be loaded.
  }

  applyLocale(localStorage.getItem('incomeInterestLocale'));
  demoController = new ExampleDemoController({
    form,
    cursor: document.querySelector('#demo-cursor'),
    ring: document.querySelector('#demo-target-ring'),
    chartView,
    chartViewModel,
    requestCalculation: () => form.requestSubmit(),
  });

  const navigationViewModel = new NavigationViewModel({
    form,
    calculatorPanel,
    methodPanel,
    demoPill,
    getDemoController: () => demoController,
    onExampleExit: () => form.requestSubmit(),
  });
  calculatorViewModel.bind();
  navigationViewModel.bind();
  navigationViewModel.setInitialView();

  if (navigationViewModel.activeView !== 'example') form.requestSubmit();
}

initialize();
