import { MAX_PROJECTION_MONTHS, MONTHS_PER_YEAR } from '/core/finance/constants.js';

const MIN_EXTRA_PROJECTION_UNITS = 2;
const MAX_EXTRA_PROJECTION_UNITS = 10;

export function chooseProjectionDuration(duration, unit, random = Math.random) {
  if (!Number.isInteger(duration) || duration <= 0) return null;
  const unitInMonths = unit === 'years' ? MONTHS_PER_YEAR : 1;
  const selectedMonths = duration * unitInMonths;
  const availableUnits = Math.min(
    MAX_EXTRA_PROJECTION_UNITS,
    Math.floor((MAX_PROJECTION_MONTHS - selectedMonths) / unitInMonths),
  );
  if (availableUnits < MIN_EXTRA_PROJECTION_UNITS) return null;
  return Math.floor(random() * (availableUnits - MIN_EXTRA_PROJECTION_UNITS + 1))
    + MIN_EXTRA_PROJECTION_UNITS;
}

/** HTTP adapter for the calculator feature. It accepts UI values, not form elements. */
export class CalculatorClient {
  constructor(fetcher = globalThis.fetch, random = Math.random) {
    this.fetcher = fetcher;
    this.random = random;
  }

  async simulate(input) {
    const enteredIncome = Number(input.income);
    const duration = Number(input.duration);
    const durationUnit = input.durationUnit;
    const projectionDuration = chooseProjectionDuration(duration, durationUnit, this.random);
    const payload = {
      monthlyContribution: input.incomePeriod === 'annual' ? enteredIncome / MONTHS_PER_YEAR : enteredIncome,
      interestRate: Number(input.interestRate),
      interestPeriod: input.interestPeriod,
      duration,
      durationUnit,
      projectionDuration,
    };

    const response = await this.fetcher('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'ERROR_NETWORK');
    return result;
  }
}
