const os = require('node:os');
const path = require('node:path');
const express = require('express');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const MAX_MONTHS = 1200;

app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/simulate', (req, res) => {
  const input = req.body;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return res.status(400).json({ error: 'ERROR_INVALID_REQUEST' });
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
    return res.status(400).json({ error: 'ERROR_INVALID_INCOME' });
  }
  if (!Number.isFinite(interestRate) || interestRate < 0) {
    return res.status(400).json({ error: 'ERROR_INVALID_RATE' });
  }
  if (interestPeriod !== 'monthly' && interestPeriod !== 'annual') {
    return res.status(400).json({ error: 'ERROR_INVALID_INTEREST_PERIOD' });
  }
  if (!Number.isInteger(duration) || duration <= 0) {
    return res.status(400).json({ error: 'ERROR_INVALID_DURATION' });
  }
  if (durationUnit !== 'months' && durationUnit !== 'years') {
    return res.status(400).json({ error: 'ERROR_INVALID_DURATION_UNIT' });
  }
  if (projectionDuration !== null && (!Number.isInteger(projectionDuration) || projectionDuration < 2 || projectionDuration > 10)) {
    return res.status(400).json({ error: 'ERROR_INVALID_PROJECTION' });
  }

  const months = durationUnit === 'years' ? duration * 12 : duration;
  if (months > MAX_MONTHS) {
    return res.status(400).json({ error: 'ERROR_DURATION_LIMIT' });
  }

  const projectionUnitMonths = durationUnit === 'years' ? 12 : 1;
  const projectionMonths = projectionDuration === null ? 0 : projectionDuration * projectionUnitMonths;
  if (months + projectionMonths > MAX_MONTHS) {
    return res.status(400).json({ error: 'ERROR_PROJECTION_LIMIT' });
  }

  const rate = interestRate / 100;
  const monthlyRate = interestPeriod === 'annual'
    ? Math.expm1(Math.log1p(rate) / 12)
    : rate;
  const monthlyFactor = 1 + monthlyRate;
  const totalContributions = monthlyContribution * months;

  if (!Number.isFinite(monthlyRate) || !Number.isFinite(totalContributions)) {
    return res.status(422).json({ error: 'ERROR_VALUES_TOO_LARGE' });
  }

  const longestProjection = months + projectionMonths;
  const timeline = [{ month: 0, contributions: 0, balance: 0 }];
  let balance = 0;

  for (let month = 1; month <= longestProjection; month += 1) {
    // Existing savings earn interest first; this month's contribution is added afterward.
    balance = balance * monthlyFactor + monthlyContribution;
    if (!Number.isFinite(balance)) {
      if (month <= months) {
        return res.status(422).json({ error: 'ERROR_RESULT_TOO_LARGE' });
      }
      break;
    }
    timeline.push({
      month,
      contributions: monthlyContribution * month,
      balance,
    });
  }

  const finalPoint = timeline[months];
  if (!finalPoint) {
    return res.status(422).json({ error: 'ERROR_RESULT_TOO_LARGE' });
  }

  const interestEarned = finalPoint.balance - totalContributions;
  const growthPercent = (interestEarned / totalContributions) * 100;
  if (!Number.isFinite(growthPercent)) {
    return res.status(422).json({ error: 'ERROR_RESULT_TOO_LARGE' });
  }

  const projectionPoint = projectionMonths > 0 ? timeline[longestProjection] : null;
  const projectionInterest = projectionPoint
    ? projectionPoint.balance - projectionPoint.contributions
    : null;

  return res.json({
    initialPatrimony: 0,
    totalContributions: roundToCents(totalContributions),
    finalPatrimony: roundToCents(finalPoint.balance),
    interestEarned: roundToCents(interestEarned),
    growthPercent,
    months,
    duration,
    durationUnit,
    monthlyRatePercent: monthlyRate * 100,
    timeline,
    projectionDuration,
    projectionMonths,
    projectionUnavailable: projectionMonths > 0 && !projectionPoint,
    projectionFinalPatrimony: projectionPoint ? roundToCents(projectionPoint.balance) : null,
    projectionAdditionalValue: projectionPoint ? roundToCents(projectionPoint.balance - finalPoint.balance) : null,
    projectionAdditionalContributions: projectionPoint ? roundToCents(projectionPoint.contributions - totalContributions) : null,
    projectionAdditionalGrowth: projectionPoint ? roundToCents(Math.max(0, projectionInterest - interestEarned)) : null,
    projectionLimitReached: months === MAX_MONTHS,
  });
});

function roundToCents(value) {
  if (Math.abs(value) >= Number.MAX_VALUE / 100) return value;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getLanAddresses() {
  const addresses = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (!entry.internal && (entry.family === 'IPv4' || entry.family === 4)) {
        addresses.push(entry.address);
      }
    }
  }
  return [...new Set(addresses)];
}

const server = app.listen(PORT, HOST, () => {
  const actualPort = server.address().port;
  console.log(`Simulator available at http://localhost:${actualPort}`);
  for (const address of getLanAddresses()) {
    console.log(`Local network access: http://${address}:${actualPort}`);
  }
});
