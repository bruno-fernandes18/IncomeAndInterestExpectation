const form = document.querySelector('#simulation-form');
const errorMessage = document.querySelector('#form-error');
const submitButton = form.querySelector('button[type="submit"]');
const chart = document.querySelector('#investment-chart');
const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const compactCurrency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});
const percentage = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setError('');
  setLoading(true);

  const payload = {
    monthlyContribution: Number(form.elements.monthlyContribution.value),
    interestRate: Number(form.elements.interestRate.value),
    interestPeriod: form.elements.interestPeriod.value,
    duration: Number(form.elements.duration.value),
    durationUnit: form.elements.durationUnit.value,
  };

  try {
    const response = await fetch('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to calculate this projection.');
    renderResult(result);
  } catch (error) {
    setError(error.message || 'Could not connect to the server. Please try again.');
  } finally {
    setLoading(false);
  }
});

function renderResult(result) {
  document.querySelector('#final-patrimony').textContent = currency.format(result.finalPatrimony);
  document.querySelector('#initial-patrimony').textContent = currency.format(result.initialPatrimony);
  document.querySelector('#total-contributions').textContent = currency.format(result.totalContributions);
  document.querySelector('#interest-earned').textContent = currency.format(result.interestEarned);
  document.querySelector('#growth-percent').textContent = `${percentage.format(result.growthPercent)}%`;
  document.querySelector('#duration-caption').textContent = `After ${formatDuration(result.months)} of monthly investing`;
  document.querySelector('#chart-period').textContent = formatDuration(result.months);
  document.querySelector('#chart-summary').textContent = `${currency.format(result.finalPatrimony)} estimated after ${formatDuration(result.months)}.`;

  renderChart(result.timeline, result.months);
  renderScenarios(result);
  renderInsight(result);
}

function renderChart(timeline, selectedMonths) {
  chart.replaceChildren();
  const width = 800;
  const height = 330;
  const margin = { top: 18, right: 22, bottom: 44, left: 68 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const maxMonth = Math.max(timeline.at(-1)?.month || selectedMonths, 1);
  const maxBalance = Math.max(...timeline.map((point) => point.balance), 1);
  const x = (month) => margin.left + (month / maxMonth) * plotWidth;
  const y = (value) => margin.top + plotHeight - (value / maxBalance) * plotHeight;

  for (let index = 0; index <= 4; index += 1) {
    const value = maxBalance * (index / 4);
    const yPosition = y(value);
    addSvg('line', { x1: margin.left, y1: yPosition, x2: width - margin.right, y2: yPosition, class: 'chart-grid-line' });
    const label = addSvg('text', { x: margin.left - 10, y: yPosition + 4, 'text-anchor': 'end', class: 'chart-axis-label' });
    label.textContent = compactCurrency.format(value);
  }

  addSvg('line', { x1: margin.left, y1: margin.top, x2: margin.left, y2: margin.top + plotHeight, class: 'chart-axis-line' });
  addSvg('line', { x1: margin.left, y1: margin.top + plotHeight, x2: width - margin.right, y2: margin.top + plotHeight, class: 'chart-axis-line' });

  const xTickMonths = [...new Set([0, Math.round(maxMonth / 2), maxMonth])];
  for (const month of xTickMonths) {
    const label = addSvg('text', { x: x(month), y: height - 13, 'text-anchor': month === 0 ? 'start' : month === maxMonth ? 'end' : 'middle', class: 'chart-axis-label' });
    label.textContent = month === 0 ? 'Start' : formatDuration(month);
  }

  const selectedX = x(selectedMonths);
  addSvg('line', { x1: selectedX, y1: margin.top, x2: selectedX, y2: margin.top + plotHeight, class: 'chart-selected-line' });

  const selectedPoints = timeline.filter((point) => point.month <= selectedMonths);
  const futurePoints = timeline.filter((point) => point.month >= selectedMonths);
  addSvg('path', { d: toPath(selectedPoints, x, (point) => y(point.contributions)), class: 'chart-contributions-path' });
  addSvg('path', { d: toPath(selectedPoints, x, (point) => y(point.balance)), class: 'chart-balance-path' });

  if (futurePoints.length > 1) {
    addSvg('path', { d: toPath(futurePoints, x, (point) => y(point.contributions)), class: 'chart-future-contributions-path' });
    addSvg('path', { d: toPath(futurePoints, x, (point) => y(point.balance)), class: 'chart-future-balance-path' });
  }

  const selectedPoint = timeline[selectedMonths];
  if (selectedPoint) addSvg('circle', { cx: selectedX, cy: y(selectedPoint.balance), r: 5, class: 'chart-current-dot' });
  chart.setAttribute('aria-label', `Investment chart: portfolio value reaches ${currency.format(selectedPoint?.balance || 0)} after ${formatDuration(selectedMonths)}. The dashed line shows a longer-term projection.`);
}

function renderScenarios(result) {
  const container = document.querySelector('#time-scenarios');
  container.replaceChildren();
  const note = document.querySelector('#scenario-note');

  if (!result.scenarios.length) {
    const empty = document.createElement('div');
    empty.className = 'scenario-empty';
    empty.textContent = result.projectionLimitReached
      ? 'This projection is already at the 100-year limit.'
      : result.longerProjectionUnavailable
        ? 'At this rate, the longer projection exceeds the calculator’s numeric range.'
        : 'No additional time is available within the 100-year projection limit.';
    container.append(empty);
    note.textContent = 'The comparison assumes monthly contributions continue at the same amount and rate.';
    return;
  }

  for (const scenario of result.scenarios) {
    const card = document.createElement('article');
    card.className = 'scenario-card';

    const label = document.createElement('p');
    label.className = 'scenario-period';
    label.textContent = `+${scenario.extraYears} ${scenario.extraYears === 1 ? 'year' : 'years'}`;

    const title = document.createElement('h3');
    title.textContent = `Invest for ${formatDuration(scenario.months)}`;

    const projectedLabel = document.createElement('span');
    projectedLabel.className = 'scenario-value-label';
    projectedLabel.textContent = 'Estimated portfolio';

    const projectedValue = document.createElement('strong');
    projectedValue.className = 'scenario-value';
    projectedValue.textContent = currency.format(scenario.finalPatrimony);

    const details = document.createElement('div');
    details.className = 'scenario-details';
    details.append(
      createScenarioDetail('Additional deposits', currency.format(scenario.additionalContributions)),
      createScenarioDetail('Additional growth', currency.format(scenario.additionalGrowth)),
    );

    card.append(label, title, projectedLabel, projectedValue, details);
    container.append(card);
  }

  note.textContent = 'Longer timelines continue the same monthly contribution and interest rate. Additional growth is the estimated interest beyond your chosen period, separate from new deposits.';
}

function createScenarioDetail(labelText, valueText) {
  const row = document.createElement('div');
  row.className = 'scenario-detail';
  const label = document.createElement('span');
  label.textContent = labelText;
  const value = document.createElement('strong');
  value.textContent = valueText;
  row.append(label, value);
  return row;
}

function renderInsight(result) {
  const copy = document.querySelector('#did-you-know-copy');
  const scenario = result.scenarios[0];
  if (!scenario) {
    copy.textContent = 'Time gives your earnings more room to earn returns of their own. Even a small regular contribution can benefit from a longer horizon.';
    return;
  }

  copy.textContent = `If you keep investing for ${scenario.extraYears} more ${scenario.extraYears === 1 ? 'year' : 'years'}, your portfolio could reach ${currency.format(scenario.finalPatrimony)}. That includes ${currency.format(scenario.additionalContributions)} in new deposits and an estimated ${currency.format(scenario.additionalGrowth)} in additional growth.`;
}

function toPath(points, x, yValue) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(point.month).toFixed(2)} ${yValue(point).toFixed(2)}`).join(' ');
}

function addSvg(name, attributes) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  chart.append(element);
  return element;
}

function formatDuration(months) {
  if (months % 12 === 0) {
    const years = months / 12;
    return `${years} ${years === 1 ? 'year' : 'years'}`;
  }
  return `${months} ${months === 1 ? 'month' : 'months'}`;
}

function setError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = !message;
}

function setLoading(isLoading) {
  submitButton.disabled = isLoading;
  submitButton.querySelector('span:first-child').textContent = isLoading ? 'Calculating…' : 'Calculate growth';
}

