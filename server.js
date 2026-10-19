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
    return res.status(400).json({ error: 'Please provide the simulation details.' });
  }

  const {
    monthlyContribution,
    interestRate,
    interestPeriod,
    duration,
    durationUnit,
  } = input;

  if (!Number.isFinite(monthlyContribution) || monthlyContribution <= 0) {
    return res.status(400).json({ error: 'Enter a monthly contribution greater than zero.' });
  }
  if (!Number.isFinite(interestRate) || interestRate < 0) {
    return res.status(400).json({ error: 'Enter a valid interest rate of zero or more.' });
  }
  if (interestPeriod !== 'monthly' && interestPeriod !== 'annual') {
    return res.status(400).json({ error: 'Choose whether the interest rate is monthly or annual.' });
  }
  if (!Number.isInteger(duration) || duration <= 0) {
    return res.status(400).json({ error: 'Enter a whole-number duration greater than zero.' });
  }
  if (durationUnit !== 'months' && durationUnit !== 'years') {
    return res.status(400).json({ error: 'Choose whether the duration is measured in months or years.' });
  }

  const months = durationUnit === 'years' ? duration * 12 : duration;
  if (months > MAX_MONTHS) {
    return res.status(400).json({ error: 'The maximum projection period is 100 years.' });
  }

  const rate = interestRate / 100;
  const monthlyRate = interestPeriod === 'annual'
    ? Math.expm1(Math.log1p(rate) / 12)
    : rate;
  const monthlyFactor = 1 + monthlyRate;
  const totalContributions = monthlyContribution * months;

  if (!Number.isFinite(monthlyRate) || !Number.isFinite(totalContributions)) {
    return res.status(422).json({ error: 'These values are too large to calculate.' });
  }

  const availableMonths = MAX_MONTHS - months;
  const extraYears = getExtraProjectionYears(availableMonths);
  const longestProjection = months + Math.max(0, ...extraYears.map((years) => years * 12));
  const timeline = [{ month: 0, contributions: 0, balance: 0 }];
  let balance = 0;

  for (let month = 1; month <= longestProjection; month += 1) {
    // Existing savings earn interest first; this month's contribution is added afterward.
    balance = balance * monthlyFactor + monthlyContribution;
    if (!Number.isFinite(balance)) {
      if (month <= months) {
        return res.status(422).json({ error: 'The result is beyond the numeric range. Try a lower rate or shorter duration.' });
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
    return res.status(422).json({ error: 'The result is beyond the numeric range. Try a lower rate or shorter duration.' });
  }

  const interestEarned = finalPoint.balance - totalContributions;
  const growthPercent = (interestEarned / totalContributions) * 100;
  if (!Number.isFinite(growthPercent)) {
    return res.status(422).json({ error: 'The result is beyond the numeric range. Try a lower rate or shorter duration.' });
  }

  const scenarios = extraYears
    .map((years) => {
      const extraMonths = years * 12;
      const point = timeline[months + extraMonths];
      if (!point) return null;

      const scenarioInterest = point.balance - point.contributions;
      return {
        extraYears: years,
        months: point.month,
        totalContributions: roundToCents(point.contributions),
        finalPatrimony: roundToCents(point.balance),
        additionalContributions: roundToCents(point.contributions - totalContributions),
        additionalValue: roundToCents(point.balance - finalPoint.balance),
        additionalGrowth: roundToCents(Math.max(0, scenarioInterest - interestEarned)),
        growthPercent: ((scenarioInterest / point.contributions) * 100),
      };
    })
    .filter(Boolean);

  return res.json({
    initialPatrimony: 0,
    totalContributions: roundToCents(totalContributions),
    finalPatrimony: roundToCents(finalPoint.balance),
    interestEarned: roundToCents(interestEarned),
    growthPercent,
    months,
    monthlyRatePercent: monthlyRate * 100,
    timeline,
    scenarios,
    projectionLimitReached: months === MAX_MONTHS,
    longerProjectionUnavailable: extraYears.length > 0 && scenarios.length === 0,
  });
});

function getExtraProjectionYears(availableMonths) {
  if (availableMonths >= 120) return [5, 10];
  if (availableMonths >= 60) return [5];
  if (availableMonths >= 12) return [Math.floor(availableMonths / 12)];
  return [];
}

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

