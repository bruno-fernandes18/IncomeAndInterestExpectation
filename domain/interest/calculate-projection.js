import {
  MAX_PROJECTION_MONTHS,
  MONTHS_PER_YEAR,
  PERCENT_TO_DECIMAL,
} from '../../shared/finance/constants.js';
import { normalizeSimulationInput, SimulationInputError } from './simulation-input.js';
import { annualPercentToMonthlyRatePercent, percentageToDecimal } from './rates.js';
import { roundToCents } from './rounding.js';

/**
 * Calculates the selected period and optional longer projection.
 * Contributions are added after an interest tick, so the final contribution
 * does not earn interest in the selected period.
 * @param {unknown} input
 */
export function calculateProjection(input) {
  const normalized = normalizeSimulationInput(input);
  const {
    monthlyContribution,
    interestRate,
    interestPeriod,
    duration,
    durationUnit,
    projectionDuration,
    months,
    projectionMonths,
    longestProjection,
  } = normalized;

  const rate = percentageToDecimal(interestRate);
  const monthlyRate = interestPeriod === 'annual'
    ? annualPercentToMonthlyRatePercent(interestRate) / PERCENT_TO_DECIMAL
    : rate;
  const compoundingFactor = 1 + rate;
  const totalContributions = monthlyContribution * months;

  if (!Number.isFinite(monthlyRate) || !Number.isFinite(totalContributions)) {
    throw new SimulationInputError('ERROR_VALUES_TOO_LARGE', 422);
  }

  const timeline = [{ month: 0, contributions: 0, balance: 0 }];
  let balance = 0;

  for (let month = 1; month <= longestProjection; month += 1) {
    const isInterestTick = interestPeriod === 'monthly' || month % MONTHS_PER_YEAR === 0;
    if (isInterestTick) balance *= compoundingFactor;
    balance += monthlyContribution;

    if (!Number.isFinite(balance)) {
      if (month <= months) throw new SimulationInputError('ERROR_RESULT_TOO_LARGE', 422);
      break;
    }

    timeline.push({
      month,
      contributions: monthlyContribution * month,
      balance,
    });
  }

  const finalPoint = timeline[months];
  if (!finalPoint) throw new SimulationInputError('ERROR_RESULT_TOO_LARGE', 422);

  const interestEarned = finalPoint.balance - totalContributions;
  const growthPercent = (interestEarned / totalContributions) * PERCENT_TO_DECIMAL;
  if (!Number.isFinite(growthPercent)) throw new SimulationInputError('ERROR_RESULT_TOO_LARGE', 422);

  const projectionPoint = projectionMonths > 0 ? timeline[longestProjection] : null;
  const projectionInterest = projectionPoint
    ? projectionPoint.balance - projectionPoint.contributions
    : null;

  return {
    initialPatrimony: 0,
    totalContributions: roundToCents(totalContributions),
    finalPatrimony: roundToCents(finalPoint.balance),
    interestEarned: roundToCents(interestEarned),
    growthPercent,
    months,
    duration,
    durationUnit,
    monthlyRatePercent: monthlyRate * PERCENT_TO_DECIMAL,
    interestRatePercent: interestRate,
    interestPeriod,
    timeline,
    projectionDuration,
    projectionMonths,
    projectionUnavailable: projectionMonths > 0 && !projectionPoint,
    projectionFinalPatrimony: projectionPoint ? roundToCents(projectionPoint.balance) : null,
    projectionAdditionalValue: projectionPoint ? roundToCents(projectionPoint.balance - finalPoint.balance) : null,
    projectionAdditionalContributions: projectionPoint
      ? roundToCents(projectionPoint.contributions - totalContributions)
      : null,
    projectionAdditionalGrowth: projectionPoint
      ? roundToCents(Math.max(0, projectionInterest - interestEarned))
      : null,
    projectionLimitReached: months === MAX_PROJECTION_MONTHS,
  };
}
