import { InvestmentChartViewModel } from './modules/chart-view-model.js';
import { InvestmentChartView } from './modules/chart-view.js';
import { InvestmentResultsView } from './modules/results-view.js';
import { InvestmentInsightsView } from './modules/insights-view.js';
import { ExampleDemoController } from './modules/demo-controller.js';
import { LOCALES, LOCALE_BY_ID } from './modules/locale-config.js';

const form = document.querySelector('#simulation-form');
const submitButton = form.querySelector('button[type="submit"]');
const errorMessage = document.querySelector('#form-error');
const chartError = document.querySelector('#chart-error');
const chartElement = document.querySelector('#investment-chart');
const localeSelect = document.querySelector('#locale-switch');
const calculatorPanel = document.querySelector('#calculator-view');
const methodPanel = document.querySelector('#view-how');
const demoPill = document.querySelector('#demo-pill');
const localeData = {};
const MONTHS_PER_YEAR = 12;
const MAX_PROJECTION_YEARS = 100;
const MAX_MONTHS = MAX_PROJECTION_YEARS * MONTHS_PER_YEAR;

let currentLocale = 'en';
let currentLocaleConfig = LOCALE_BY_ID.en;
let activeView = 'home';
let latestResult = null;
let calculationTimer = null;
let latestCalculationRequest = 0;
let latestErrorKey = '';
let demoController = null;
let savedHomeValues = null;

function text(key) {
  return localeData[currentLocale]?.[key] || localeData.en?.[key] || key;
}

function formatTemplate(key, values = {}) {
  return Object.entries(values).reduce(
    (copy, [name, value]) => copy.replaceAll(`{${name}}`, String(value)),
    text(key),
  );
}

function formatNumber(value) {
  return new Intl.NumberFormat(currentLocaleConfig.tag).format(value);
}

function formatCurrency(value) {
  return new Intl.NumberFormat(currentLocaleConfig.tag, {
    style: 'currency',
    currency: currentLocaleConfig.currency,
  }).format(value);
}

function formatCompactCurrency(value) {
  if (Math.abs(value) >= 1e15) {
    return new Intl.NumberFormat(currentLocaleConfig.tag, {
      style: 'currency',
      currency: currentLocaleConfig.currency,
      notation: 'scientific',
      maximumSignificantDigits: 3,
    }).format(value);
  }
  return new Intl.NumberFormat(currentLocaleConfig.tag, {
    style: 'currency',
    currency: currentLocaleConfig.currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatPercent(value) {
  return new Intl.NumberFormat(currentLocaleConfig.tag, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCompactPercent(value) {
  if (Math.abs(value) >= 1e15) {
    return new Intl.NumberFormat(currentLocaleConfig.tag, {
      notation: 'scientific',
      maximumSignificantDigits: 3,
    }).format(value);
  }
  return new Intl.NumberFormat(currentLocaleConfig.tag, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatChartCurrency(value) {
  if (Math.abs(value) < 1e9) return formatCurrency(value);
  return new Intl.NumberFormat(currentLocaleConfig.tag, {
    style: 'currency',
    currency: currentLocaleConfig.currency,
    notation: 'scientific',
    maximumSignificantDigits: 6,
  }).format(value);
}

function formatTimeAmount(amount, unit) {
  const key = unit === 'years' ? 'TIME_YEAR' : 'TIME_MONTH';
  const plural = amount === 1 ? 'ONE' : 'OTHER';
  return `${formatNumber(amount)} ${text(`${key}_${plural}`)}`;
}

function formatAxisMonth(month) {
  if (month >= MONTHS_PER_YEAR && month % MONTHS_PER_YEAR === 0) return `${formatNumber(month / MONTHS_PER_YEAR)} ${text('CHART_YEAR_ABBR')}`;
  return `${formatNumber(month)} ${text('CHART_MONTH_ABBR')}`;
}

function chartAria(result) {
  const duration = formatTimeAmount(result.duration, result.durationUnit);
  const selected = formatTemplate('CHART_ARIA_SELECTED', {
    value: formatCurrency(result.finalPatrimony),
    duration,
  });
  const projection = result.projectionMonths > 0 ? text('CHART_ARIA_PROJECTION') : '';
  return `${text('CHART_ARIA')} ${selected}${projection}`;
}

async function loadLocales() {
  const responses = await Promise.all(LOCALES.map(async ({ id }) => {
    const response = await fetch(`/locales/${id}.json`);
    if (!response.ok) throw new Error('LOCALE_LOAD_FAILED');
    return [id, await response.json()];
  }));
  for (const [id, translations] of responses) localeData[id] = translations;
}

function applyLocale(locale) {
  currentLocale = LOCALE_BY_ID[locale] && localeData[locale] ? locale : 'en';
  currentLocaleConfig = LOCALE_BY_ID[currentLocale];
  localeSelect.value = currentLocale;
  document.documentElement.lang = currentLocaleConfig.tag;
  document.documentElement.dir = currentLocaleConfig.direction;
  document.querySelector('#brand-name').dataset.order = currentLocaleConfig.brandOrder;
  if (!localeData.en || Object.keys(localeData.en).length === 0) return;

  document.title = text('HEADER_TITLE');
  for (const element of document.querySelectorAll('[data-i18n]')) {
    element.textContent = text(element.dataset.i18n);
  }
  for (const element of document.querySelectorAll('[data-i18n-aria]')) {
    element.setAttribute('aria-label', text(element.dataset.i18nAria));
  }
  for (const element of document.querySelectorAll('[data-i18n-content]')) {
    element.setAttribute('content', text(element.dataset.i18nContent));
  }
  const currencySymbol = document.querySelector('#currency-symbol');
  currencySymbol.textContent = currentLocaleConfig.currency;
  const currencyName = typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames([currentLocaleConfig.tag], { type: 'currency' }).of(currentLocaleConfig.currency)
    : currentLocaleConfig.currency;
  currencySymbol.title = `${currencyName} (${currentLocaleConfig.currency})`;
  document.querySelector('#monthly-contribution').setAttribute(
    'aria-label',
    `${text('INCOME_AMOUNT_ARIA')} (${currentLocaleConfig.currency})`,
  );
  if (latestResult) renderResult(latestResult);
  if (latestErrorKey) setError(text(latestErrorKey));
}

function switchView(view, updateAddress = true) {
  const destination = ['home', 'how', 'example'].includes(view) ? view : 'home';
  const previousView = activeView;
  if (previousView !== 'example' && destination === 'example') savedHomeValues = captureFormValues();
  if (previousView === 'example' && destination !== 'example') {
    demoController?.stop();
    if (savedHomeValues) restoreFormValues(savedHomeValues);
  }
  activeView = destination;
  calculatorPanel.hidden = destination === 'how';
  methodPanel.hidden = destination !== 'how';
  for (const link of document.querySelectorAll('[data-view-link]')) {
    if (link.dataset.viewLink === destination) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  demoPill.hidden = destination !== 'example';
  if (updateAddress) history.pushState({ view: destination }, '', `#${viewHash(destination)}`);
  if (destination === 'example') demoController?.start();
  else if (previousView === 'example' && savedHomeValues) {
    savedHomeValues = null;
    form.requestSubmit();
  }
}

function captureFormValues() {
  return Object.fromEntries([...form.elements]
    .filter((element) => element.name)
    .map((element) => [element.name, element.value]));
}

function restoreFormValues(values) {
  for (const [name, value] of Object.entries(values)) {
    const field = form.elements[name];
    if (field) field.value = value;
  }
}

function viewHash(view) {
  if (view === 'how') return 'how-its-calculated';
  return view;
}

function viewFromHash() {
  if (location.hash === '#how-its-calculated') return 'how';
  if (location.hash === '#example') return 'example';
  return 'home';
}

document.querySelectorAll('[data-view-link]').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    switchView(link.dataset.viewLink);
  });
});
window.addEventListener('popstate', () => switchView(viewFromHash(), false));

const chartViewModel = new InvestmentChartViewModel();
const chartView = new InvestmentChartView(chartElement, chartViewModel, {
  currency: formatChartCurrency,
  fullCurrency: formatCurrency,
  compactCurrency: formatCompactCurrency,
  percent: formatPercent,
  axisMonth: formatAxisMonth,
  pointMonth: (month) => formatTemplate('CHART_POINT_MONTH', {
    month: formatNumber(month),
    duration: formatTimeAmount(month, 'months'),
  }),
  tooltipContributions: (point) => formatTemplate('CHART_TOOLTIP_CONTRIBUTIONS', {
    value: formatChartCurrency(point.contributions),
  }),
  tooltipInterest: (point) => formatTemplate('CHART_TOOLTIP_INTEREST', {
    value: formatChartCurrency(point.balance - point.contributions),
  }),
  chartAria,
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
  currency: formatCurrency,
  compactCurrency: formatCompactCurrency,
  percent: formatPercent,
  compactPercent: formatCompactPercent,
  duration: formatTimeAmount,
});
const insightsView = new InvestmentInsightsView({
  kicker: document.querySelector('.insight-kicker'),
  copy: document.querySelector('#did-you-know-copy'),
  count: document.querySelector('#insight-count'),
  next: document.querySelector('#insight-next'),
}, {
  percent: formatPercent,
  currency: formatCompactCurrency,
  unit: (amount, selectedUnit) => text(`${selectedUnit === 'years' ? 'TIME_YEAR' : 'TIME_MONTH'}_${amount === 1 ? 'ONE' : 'OTHER'}`),
}, text, formatTemplate);

async function submitCalculation(event) {
  event.preventDefault();
  setError('');
  chartError.hidden = true;
  const requestId = ++latestCalculationRequest;
  setLoading(true);

  const enteredIncome = Number(form.elements.monthlyContribution.value);
  const duration = Number(form.elements.duration.value);
  const durationUnit = form.elements.durationUnit.value;
  const projectionDuration = chooseProjectionDuration(duration, durationUnit);
  const payload = {
    monthlyContribution: form.elements.incomePeriod.value === 'annual' ? enteredIncome / MONTHS_PER_YEAR : enteredIncome,
    interestRate: Number(form.elements.interestRate.value),
    interestPeriod: form.elements.interestPeriod.value,
    duration,
    durationUnit,
    projectionDuration,
  };

  try {
    const response = await fetch('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'ERROR_NETWORK');
    if (requestId !== latestCalculationRequest) return;
    latestResult = result;
    renderResult(result);
    demoController?.onCalculationResult(result);
  } catch (error) {
    if (requestId === latestCalculationRequest) {
      latestErrorKey = localeData[currentLocale]?.[error.message] ? error.message : 'ERROR_NETWORK';
      setError(text(latestErrorKey));
      demoController?.onCalculationError();
    }
  } finally {
    if (requestId === latestCalculationRequest) setLoading(false);
  }
}

form.addEventListener('submit', submitCalculation);
form.addEventListener('input', () => {
  if (!demoController?.applyingValues) scheduleCalculation();
});
form.querySelectorAll('select').forEach((select) => select.addEventListener('change', () => {
  if (!demoController?.applyingValues) scheduleCalculation();
}));
window.addEventListener('resize', () => {
  if (latestResult) resultsView.render(latestResult);
});

function chooseProjectionDuration(duration, unit) {
  if (!Number.isInteger(duration) || duration <= 0) return null;
  const unitInMonths = unit === 'years' ? MONTHS_PER_YEAR : 1;
  const selectedMonths = duration * unitInMonths;
  const maximumAdditionalUnits = Math.min(10, Math.floor((MAX_MONTHS - selectedMonths) / unitInMonths));
  if (maximumAdditionalUnits < 2) return null;
  return Math.floor(Math.random() * (maximumAdditionalUnits - 1)) + 2;
}

function scheduleCalculation() {
  window.clearTimeout(calculationTimer);
  calculationTimer = window.setTimeout(() => {
    if (form.checkValidity()) form.requestSubmit();
  }, 360);
}

function renderResult(result) {
  resultsView.render(result);
  chartViewModel.setResult(result);
  insightsView.update(result);
}

function setError(message) {
  if (!message) latestErrorKey = '';
  errorMessage.textContent = message;
  errorMessage.hidden = !message;
}

function setLoading(isLoading) {
  submitButton.disabled = isLoading;
  form.setAttribute('aria-busy', String(isLoading));
}

localeSelect.addEventListener('change', () => {
  applyLocale(localeSelect.value);
  localStorage.setItem('incomeInterestLocale', currentLocale);
});

async function initialize() {
  try {
    await loadLocales();
  } catch { /* Embedded English strings remain as a readable fallback. */ }
  const savedLocale = localStorage.getItem('incomeInterestLocale');
  applyLocale(savedLocale);
  demoController = new ExampleDemoController({
    form,
    cursor: document.querySelector('#demo-cursor'),
    ring: document.querySelector('#demo-target-ring'),
    chartView,
    chartViewModel,
    requestCalculation: () => form.requestSubmit(),
  });
  const initialView = viewFromHash();
  switchView(initialView, false);
  if (initialView === 'example') demoController.start();
  else form.requestSubmit();
}

initialize();
