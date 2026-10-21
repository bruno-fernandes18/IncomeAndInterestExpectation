import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateProjection } from '../../../domain/interest/calculate-projection.js';
import { SimulationInputError } from '../../../domain/interest/simulation-input.js';

const monthlyInput = {
  monthlyContribution: 100,
  interestRate: 1,
  interestPeriod: 'monthly',
  duration: 2,
  durationUnit: 'months',
};

test('adds each contribution after monthly interest so the last contribution earns no interest', () => {
  const result = calculateProjection(monthlyInput);

  assert.equal(result.finalPatrimony, 201);
  assert.equal(result.totalContributions, 200);
  assert.equal(result.interestEarned, 1);
  assert.equal(result.growthPercent, 0.5);
  assert.deepEqual(result.timeline.map(({ month }) => month), [0, 1, 2]);
});

test('an annual rate compounds at annual ticks, not as a monthly rate', () => {
  const result = calculateProjection({
    ...monthlyInput,
    interestRate: 12,
    interestPeriod: 'annual',
    duration: 12,
  });

  assert.equal(result.finalPatrimony, 1332);
  const expectedEquivalentMonthlyRate = Math.expm1(Math.log1p(0.12) / 12) * 100;
  assert.ok(Math.abs(result.monthlyRatePercent - expectedEquivalentMonthlyRate) < 1e-12);
  assert.equal(result.timeline[11].balance, 1100);
});

test('returns monthly-granularity points through an optional future projection', () => {
  const result = calculateProjection({
    ...monthlyInput,
    duration: 12,
    projectionDuration: 2,
  });

  assert.equal(result.months, 12);
  assert.equal(result.projectionMonths, 2);
  assert.equal(result.timeline.length, 15);
  assert.equal(result.projectionAdditionalContributions, 200);
  assert.ok(result.projectionFinalPatrimony > result.finalPatrimony);
});

test('rejects invalid API input with a stable domain error code', () => {
  assert.throws(
    () => calculateProjection({ ...monthlyInput, duration: 0 }),
    (error) => error instanceof SimulationInputError && error.code === 'ERROR_INVALID_DURATION',
  );
});
