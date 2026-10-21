const piDigits = '31415926535897932384626433832795028841971693993751';

export const DEMO_CONFIG = Object.freeze({
  piDigits,
  monthsPerYear: 12,
  percentToDecimal: 100,
  randomChoiceThreshold: 0.5,
  highestPiDigit: 9,
  digitMultipliers: Object.freeze([100, 75, 100, 50]),
  values: Object.freeze({
    minimumIncome: 100,
    maximumIncome: 50000,
    incomeIncrement: 10,
    minimumAnnualRatePercent: 0.5,
    maximumAnnualRatePercent: 20,
    annualRateMeanPercent: 9,
    annualRateStandardDeviationPercent: 3.8,
    annualRateDecimalPlaces: 2,
    monthlyRateDecimalPlaces: 2,
    durationReductionStartAnnualRatePercent: 14,
    durationReductionRateStepPercent: 0.01,
    durationReductionPerRateStepPercent: 0.13,
    minimumDurationYears: 1,
    minimumEvenMonth: 6,
    maximumEvenMonth: 64,
    durationMonthIncrement: 2,
    minimumAnnualDurationYears: 2,
    maximumDurationYears: 30,
    shortDurationYears: 5,
  }),
  motion: Object.freeze({
    referenceApproachDurationMs: 4000,
    referenceOrbitDurationMs: 15000,
    referenceOrbitTurns: 4,
    cursorSpeedMultiplier: 2,
    maximumOrbitRadiusPx: 18,
    minimumOrbitRadiusPx: 4,
    plotHorizontalInsetPx: 22,
    plotBottomInsetPx: 50,
    typingMsPerCharacter: 110,
    selectSettleMs: 220,
    userIdleBeforeResumeMs: 900,
    neutralPauseMs: 10000,
    retryDelayMs: 1800,
    maximumFrameDeltaMs: 100,
    initialOffscreenOffsetPx: 40,
    cursorHotspotX: 2,
    cursorHotspotY: 2,
    neutralFallbackX: 0.5,
    neutralFallbackY: 0.46,
  }),
});

export const DEMO_YEAR_CHOICES = Object.freeze(
  Array.from({ length: DEMO_CONFIG.values.maximumDurationYears }, (_, index) => index + 1)
    .filter((year) => year <= DEMO_CONFIG.values.shortDurationYears || year % 2 === 0 || year % 5 === 0),
);

export const DEMO_HIGH_RATE_YEAR_CHOICES = Object.freeze(
  DEMO_YEAR_CHOICES.filter((year) => year >= DEMO_CONFIG.values.minimumAnnualDurationYears),
);
