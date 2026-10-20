const form = document.querySelector('#simulation-form');
const submitButton = form.querySelector('button[type="submit"]');
const errorMessage = document.querySelector('#form-error');
const chart = document.querySelector('#investment-chart');
const localeSelect = document.querySelector('#locale-switch');
const exampleError = document.querySelector('#example-error');
const localeData = {};
const MAX_MONTHS = 1200;

let currentLocale = 'en';
let latestResult = null;
let latestExample = null;
let calculationTimer = null;
let latestCalculationRequest = 0;
let latestExampleRequest = 0;
let latestErrorKey = '';

function text(key) {
  return localeData[currentLocale]?.[key] || localeData.en?.[key] || key;
}

function formatTemplate(key, values = {}) {
  return Object.entries(values).reduce(
    (copy, [name, value]) => copy.replaceAll(`{${name}}`, String(value)),
    text(key),
  );
}

function formatCurrency(value) {
  return new Intl.NumberFormat(currentLocale === 'pt' ? 'pt-BR' : 'en-US', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCompactCurrency(value) {
  return new Intl.NumberFormat(currentLocale === 'pt' ? 'pt-BR' : 'en-US', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatPercent(value) {
  return new Intl.NumberFormat(currentLocale === 'pt' ? 'pt-BR' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatTimeAmount(amount, unit) {
  const unitKey = unit === 'years' ? 'TIME_YEAR' : 'TIME_MONTH';
  const pluralKey = amount === 1 ? `${unitKey}_ONE` : `${unitKey}_OTHER`;
  return `${amount} ${text(pluralKey)}`;
}

async function loadLocales() {
  const [englishResponse, portugueseResponse] = await Promise.all([
    fetch('/locales/en.json'),
    fetch('/locales/pt.json'),
  ]);
  if (!englishResponse.ok || !portugueseResponse.ok) throw new Error('LOCALE_LOAD_FAILED');
  localeData.en = await englishResponse.json();
  localeData.pt = await portugueseResponse.json();
}

function applyLocale(locale) {
  currentLocale = locale === 'pt' ? 'pt' : 'en';
  if (!localeData[currentLocale] || Object.keys(localeData[currentLocale]).length === 0) currentLocale = 'en';
  localeSelect.value = currentLocale;
  document.documentElement.lang = currentLocale === 'pt' ? 'pt-BR' : 'en';
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

  if (latestResult) renderResult(latestResult);
  if (latestExample) renderExample(latestExample);
  if (latestErrorKey) setError(text(latestErrorKey));
  if (!exampleError.hidden) exampleError.textContent = text('EXAMPLE_ERROR');
}

function switchView(view, updateAddress = true) {
  const destination = document.querySelector(`[data-view-panel="${view}"]`)
    ? view
    : 'home';
  for (const panel of document.querySelectorAll('[data-view-panel]')) {
    panel.hidden = panel.dataset.viewPanel !== destination;
  }
  for (const link of document.querySelectorAll('[data-view-link]')) {
    if (link.dataset.viewLink === destination) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  if (updateAddress) history.pushState({ view: destination }, '', `#${viewHash(destination)}`);
  if (destination === 'example' && !latestExample) calculateExample();
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

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setError('');
  const requestId = ++latestCalculationRequest;
  setLoading(true);

  const enteredIncome = Number(form.elements.monthlyContribution.value);
  const duration = Number(form.elements.duration.value);
  const durationUnit = form.elements.durationUnit.value;
  const projectionDuration = chooseProjectionDuration(duration, durationUnit);
  const payload = {
    monthlyContribution: form.elements.incomePeriod.value === 'annual' ? enteredIncome / 12 : enteredIncome,
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
  } catch (error) {
    if (requestId === latestCalculationRequest) {
      latestErrorKey = localeData[currentLocale]?.[error.message] ? error.message : 'ERROR_NETWORK';
      setError(text(latestErrorKey));
    }
  } finally {
    if (requestId === latestCalculationRequest) setLoading(false);
  }
});

form.addEventListener('input', scheduleCalculation);
form.querySelectorAll('select').forEach((select) => select.addEventListener('change', scheduleCalculation));

function chooseProjectionDuration(duration, unit) {
  if (!Number.isInteger(duration) || duration <= 0) return null;
  const unitInMonths = unit === 'years' ? 12 : 1;
  const selectedMonths = duration * unitInMonths;
  const maximumAdditionalUnits = Math.min(10, Math.floor((MAX_MONTHS - selectedMonths) / unitInMonths));
  if (maximumAdditionalUnits < 2) return null;
  return Math.floor(Math.random() * (maximumAdditionalUnits - 1)) + 2;
}

function scheduleCalculation() {
  window.clearTimeout(calculationTimer);
  calculationTimer = window.setTimeout(() => {
    if (form.reportValidity()) form.requestSubmit();
  }, 350);
}

function renderResult(result) {
  document.querySelector('#initial-patrimony').textContent = formatCurrency(result.initialPatrimony);
  document.querySelector('#final-patrimony').textContent = formatCurrency(result.finalPatrimony);
  document.querySelector('#growth-percent').textContent = `${formatPercent(result.growthPercent)}%`;
  document.querySelector('#duration-caption').textContent = formatTemplate('SUMMARY_DURATION', {
    duration: formatTimeAmount(result.duration, result.durationUnit),
  });
  document.querySelector('#chart-period').textContent = formatTimeAmount(result.duration, result.durationUnit);
  renderChart(chart, result);
  renderInsight(result);
}

function renderChart(targetChart, result) {
  targetChart.replaceChildren();
  const width = 1500;
  const height = 430;
  const margin = { top: 22, right: 18, bottom: 48, left: 88 };
  const axisY = height - margin.bottom;
  const plotHeight = axisY - margin.top;
  const plotWidth = width - margin.left - margin.right;
  const dataWidth = plotWidth * 0.7;
  const timeline = result.timeline;
  const selectedMonths = result.months;
  const maxMonth = Math.max(timeline.at(-1)?.month || selectedMonths, 1);
  const maxBalance = Math.max(...timeline.map((point) => point.balance), 1);
  const x = (month) => margin.left + (month / maxMonth) * dataWidth;
  const y = (value) => margin.top + plotHeight - (value / maxBalance) * plotHeight;

  for (let index = 0; index <= 8; index += 1) {
    const yPosition = margin.top + (plotHeight * index) / 8;
    addSvg(targetChart, 'line', { x1: margin.left - 10, y1: yPosition, x2: margin.left, y2: yPosition, class: 'chart-tick' });
    if (index % 2 === 0) {
      const value = maxBalance * (1 - index / 8);
      const label = addSvg(targetChart, 'text', { x: margin.left - 17, y: yPosition + 4, 'text-anchor': 'end', class: 'chart-axis-label' });
      label.textContent = formatCompactCurrency(value);
    }
  }

  addSvg(targetChart, 'line', { x1: margin.left, y1: margin.top, x2: margin.left, y2: axisY, class: 'chart-axis-line' });
  addSvg(targetChart, 'line', { x1: margin.left, y1: axisY, x2: width - margin.right, y2: axisY, class: 'chart-axis-line' });

  const tickMonths = [...new Set([0, Math.round(maxMonth / 4), Math.round(maxMonth / 2), Math.round((maxMonth * 3) / 4), maxMonth])];
  for (const month of tickMonths) {
    const xPosition = margin.left + (month / maxMonth) * plotWidth;
    addSvg(targetChart, 'line', { x1: xPosition, y1: axisY, x2: xPosition, y2: axisY + 9, class: 'chart-tick' });
  }

  const selectedX = x(selectedMonths);
  if (result.projectionMonths > 0) {
    addSvg(targetChart, 'line', { x1: selectedX, y1: margin.top + 8, x2: selectedX, y2: axisY, class: 'chart-selected-line' });
  }

  const selectedPoints = timeline.filter((point) => point.month <= selectedMonths);
  const futurePoints = timeline.filter((point) => point.month >= selectedMonths);
  addSvg(targetChart, 'path', { d: toPath(selectedPoints, x, (point) => y(point.balance)), class: 'chart-balance-path' });
  if (futurePoints.length > 1) {
    addSvg(targetChart, 'path', { d: toPath(futurePoints, x, (point) => y(point.balance)), class: 'chart-future-path' });
  }

  const selectedPoint = timeline.find((point) => point.month === selectedMonths);
  const selectedLabel = formatTimeAmount(result.duration, result.durationUnit);
  const aria = formatTemplate('CHART_ARIA_SELECTED', {
    value: formatCurrency(selectedPoint?.balance || 0),
    duration: selectedLabel,
  });
  const projectionAria = result.projectionMonths > 0
    ? text('CHART_ARIA_PROJECTION').replace('{duration}', formatTimeAmount(result.projectionDuration, result.durationUnit))
    : '';
  targetChart.setAttribute('aria-label', `${aria}${projectionAria}`);
}

function renderInsight(result) {
  const copy = document.querySelector('#did-you-know-copy');
  if (result.projectionUnavailable) {
    copy.textContent = text('DID_YOU_KNOW_UNAVAILABLE');
    return;
  }
  if (!result.projectionDuration) {
    copy.textContent = text('DID_YOU_KNOW_LIMIT');
    return;
  }

  const increase = result.finalPatrimony > 0
    ? ((result.projectionAdditionalValue / result.finalPatrimony) * 100)
    : 0;
  copy.textContent = formatTemplate('DID_YOU_KNOW_TEMPLATE', {
    duration: result.projectionDuration,
    unit: getTranslatedUnit(result.projectionDuration, result.durationUnit),
    percent: formatPercent(increase),
    value: formatCurrency(result.projectionFinalPatrimony),
  });
}

function getTranslatedUnit(amount, unit) {
  return text(`${unit === 'years' ? 'TIME_YEAR' : 'TIME_MONTH'}_${amount === 1 ? 'ONE' : 'OTHER'}`);
}

function toPath(points, xPosition, yValue) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${xPosition(point.month).toFixed(2)} ${yValue(point).toFixed(2)}`).join(' ');
}

function addSvg(targetChart, name, attributes) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  targetChart.append(element);
  return element;
}

function setError(message) {
  if (!message) latestErrorKey = '';
  errorMessage.textContent = message;
  errorMessage.hidden = !message;
}

function setLoading(isLoading) {
  submitButton.disabled = isLoading;
}

async function calculateExample() {
  const requestId = ++latestExampleRequest;
  exampleError.hidden = true;
  try {
    const response = await fetch('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        monthlyContribution: 500,
        interestRate: 8,
        interestPeriod: 'annual',
        duration: 10,
        durationUnit: 'years',
        projectionDuration: 5,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'EXAMPLE_ERROR');
    if (requestId !== latestExampleRequest) return;
    latestExample = result;
    renderExample(result);
  } catch {
    if (requestId === latestExampleRequest) {
      exampleError.textContent = text('EXAMPLE_ERROR');
      exampleError.hidden = false;
    }
  }
}

function renderExample(result) {
  document.querySelector('#example-input-contribution').textContent = formatCurrency(500);
  document.querySelector('#example-input-rate').textContent = `${formatPercent(8)}%`;
  document.querySelector('#example-input-duration').textContent = '10';
  document.querySelector('#example-contributions').textContent = formatCurrency(result.totalContributions);
  document.querySelector('#example-interest').textContent = formatCurrency(result.interestEarned);
  document.querySelector('#example-final').textContent = formatCurrency(result.finalPatrimony);
}

document.querySelector('#use-example').addEventListener('click', () => {
  form.elements.monthlyContribution.value = '500';
  form.elements.incomePeriod.value = 'monthly';
  form.elements.interestRate.value = '8';
  form.elements.interestPeriod.value = 'annual';
  form.elements.duration.value = '10';
  form.elements.durationUnit.value = 'years';
  switchView('home');
  form.requestSubmit();
});

localeSelect.addEventListener('change', () => {
  applyLocale(localeSelect.value);
  localStorage.setItem('incomeInterestLocale', currentLocale);
});

async function initialize() {
  try {
    await loadLocales();
  } catch { /* Keep the English text embedded in the page if locale files are unavailable. */ }
  const savedLocale = localStorage.getItem('incomeInterestLocale');
  applyLocale(savedLocale === 'pt' ? 'pt' : 'en');
  const initialView = viewFromHash();
  switchView(initialView, false);
  form.requestSubmit();
}

initialize();
