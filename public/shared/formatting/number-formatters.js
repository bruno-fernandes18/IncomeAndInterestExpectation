import { MONTHS_PER_YEAR } from '/core/finance/constants.js';

/** Creates locale dependent formatters without exposing locale rules to views. */
export function createNumberFormatters({ getLocaleConfig, text, template }) {
  function number(value) {
    return new Intl.NumberFormat(getLocaleConfig().tag).format(value);
  }

  function currency(value) {
    const { tag, currency: currencyCode } = getLocaleConfig();
    return new Intl.NumberFormat(tag, { style: 'currency', currency: currencyCode }).format(value);
  }

  function compactCurrency(value) {
    const { tag, currency: currencyCode } = getLocaleConfig();
    const options = Math.abs(value) >= 1e15
      ? { notation: 'scientific', maximumSignificantDigits: 3 }
      : { notation: 'compact', maximumFractionDigits: 1 };
    return new Intl.NumberFormat(tag, {
      style: 'currency',
      currency: currencyCode,
      ...options,
    }).format(value);
  }

  function percent(value) {
    return new Intl.NumberFormat(getLocaleConfig().tag, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  function compactPercent(value) {
    const options = Math.abs(value) >= 1e15
      ? { notation: 'scientific', maximumSignificantDigits: 3 }
      : { notation: 'compact', maximumFractionDigits: 1 };
    return new Intl.NumberFormat(getLocaleConfig().tag, options).format(value);
  }

  function chartCurrency(value) {
    if (Math.abs(value) < 1e9) return currency(value);
    const { tag, currency: currencyCode } = getLocaleConfig();
    return new Intl.NumberFormat(tag, {
      style: 'currency',
      currency: currencyCode,
      notation: 'scientific',
      maximumSignificantDigits: 6,
    }).format(value);
  }

  function timeAmount(amount, unit) {
    const key = unit === 'years' ? 'TIME_YEAR' : 'TIME_MONTH';
    return `${number(amount)} ${text(`${key}_${amount === 1 ? 'ONE' : 'OTHER'}`)}`;
  }

  function axisMonth(month) {
    if (month >= MONTHS_PER_YEAR && month % MONTHS_PER_YEAR === 0) {
      return `${number(month / MONTHS_PER_YEAR)} ${text('CHART_YEAR_ABBR')}`;
    }
    return `${number(month)} ${text('CHART_MONTH_ABBR')}`;
  }

  function chartAria(result) {
    const duration = timeAmount(result.duration, result.durationUnit);
    const selected = template('CHART_ARIA_SELECTED', {
      value: currency(result.finalPatrimony),
      duration,
    });
    const projection = result.projectionMonths > 0 ? text('CHART_ARIA_PROJECTION') : '';
    return `${text('CHART_ARIA')} ${selected}${projection}`;
  }

  return Object.freeze({
    number,
    currency,
    compactCurrency,
    percent,
    compactPercent,
    chartCurrency,
    timeAmount,
    axisMonth,
    chartAria,
  });
}
