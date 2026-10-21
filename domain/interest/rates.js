import { MONTHS_PER_YEAR, PERCENT_TO_DECIMAL } from '../../shared/finance/constants.js';

export function percentageToDecimal(percent) {
  return percent / PERCENT_TO_DECIMAL;
}

/** Converts an effective annual rate to an equivalent effective monthly rate. */
export function annualToMonthlyRate(annualRate) {
  return Math.expm1(Math.log1p(annualRate) / MONTHS_PER_YEAR);
}

export function annualPercentToMonthlyRatePercent(annualRatePercent) {
  return annualToMonthlyRate(percentageToDecimal(annualRatePercent)) * PERCENT_TO_DECIMAL;
}
