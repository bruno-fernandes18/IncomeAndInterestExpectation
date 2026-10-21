import { MAX_PROJECTION_MONTHS, MONTHS_PER_YEAR } from '../../shared/finance/constants.js';

const VALID_INTEREST_PERIODS = new Set(['monthly', 'annual']);
const VALID_DURATION_UNITS = new Set(['months', 'years']);

export class SimulationInputError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.name = 'SimulationInputError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Validates an untrusted API request and returns canonical simulation units.
 * @param {unknown} input
 */
export function normalizeSimulationInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new SimulationInputError('ERROR_INVALID_REQUEST');
  }

  const {
    monthlyContribution,
    interestRate,
    interestPeriod,
    duration,
    durationUnit,
    projectionDuration = null,
  } = input;

  if (!Number.isFinite(monthlyContribution) || monthlyContribution <= 0) {
    throw new SimulationInputError('ERROR_INVALID_INCOME');
  }
  if (!Number.isFinite(interestRate) || interestRate < 0) {
    throw new SimulationInputError('ERROR_INVALID_RATE');
  }
  if (!VALID_INTEREST_PERIODS.has(interestPeriod)) {
    throw new SimulationInputError('ERROR_INVALID_INTEREST_PERIOD');
  }
  if (!Number.isInteger(duration) || duration <= 0) {
    throw new SimulationInputError('ERROR_INVALID_DURATION');
  }
  if (!VALID_DURATION_UNITS.has(durationUnit)) {
    throw new SimulationInputError('ERROR_INVALID_DURATION_UNIT');
  }
  if (projectionDuration !== null && (!Number.isInteger(projectionDuration)
      || projectionDuration < 2 || projectionDuration > 10)) {
    throw new SimulationInputError('ERROR_INVALID_PROJECTION');
  }

  const months = durationUnit === 'years' ? duration * MONTHS_PER_YEAR : duration;
  if (months > MAX_PROJECTION_MONTHS) {
    throw new SimulationInputError('ERROR_DURATION_LIMIT');
  }

  const projectionUnitMonths = durationUnit === 'years' ? MONTHS_PER_YEAR : 1;
  const projectionMonths = projectionDuration === null ? 0 : projectionDuration * projectionUnitMonths;
  if (months + projectionMonths > MAX_PROJECTION_MONTHS) {
    throw new SimulationInputError('ERROR_PROJECTION_LIMIT');
  }

  return {
    monthlyContribution,
    interestRate,
    interestPeriod,
    duration,
    durationUnit,
    projectionDuration,
    months,
    projectionMonths,
    longestProjection: months + projectionMonths,
  };
}
