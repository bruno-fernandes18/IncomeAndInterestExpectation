import { DEMO_CONFIG, DEMO_YEAR_CHOICES, DEMO_HIGH_RATE_YEAR_CHOICES } from './example-demo-config.js';
import { PiDigitSequence } from './pi-digit-sequence.js';

const { motion, values } = DEMO_CONFIG;

/** Animates the example's Windows-style cursor and types one Pi-based scenario at a time. */
export class ExampleDemoController {
  constructor({ form, cursor, ring, chartView, chartViewModel, requestCalculation }) {
    this.form = form;
    this.cursor = cursor;
    this.ring = ring;
    this.chartView = chartView;
    this.chartViewModel = chartViewModel;
    this.requestCalculation = requestCalculation;
    this.sequence = new PiDigitSequence();
    this.active = false;
    this.applyingValues = false;
    this.state = 'stopped';
    this.timer = null;
    this.animation = null;
    this.pendingWait = null;
    this.neutralMovePromise = null;
    this.routineId = 0;
    this.cursorSpeedPxPerMs = 0;
    this.lastResult = null;
    this.resumeReady = false;
    this.activeAiElement = null;
    this.handleUserActivity = this.handleUserActivity.bind(this);
    this.handleFocusOut = this.handleFocusOut.bind(this);
    this.form.addEventListener('input', this.handleUserActivity);
    this.form.addEventListener('change', this.handleUserActivity);
    this.form.addEventListener('focusin', this.handleUserActivity);
    this.form.addEventListener('focusout', this.handleFocusOut);
  }

  start() {
    if (this.active) return;
    this.active = true;
    this.state = this.lastResult ? 'starting' : 'priming';
    document.body.classList.add('demo-active');
    if (this.lastResult) this.enterDemo();
    else this.requestCalculation();
  }

  stop() {
    this.active = false;
    this.state = 'stopped';
    this.resumeReady = false;
    this.cancelRoutine();
    this.chartViewModel.clearSelection();
    this.cursor.setAttribute('hidden', '');
    this.ring.hidden = true;
    document.body.classList.remove('demo-active');
  }

  onCalculationResult(result) {
    this.lastResult = result;
    if (!this.active) return;
    if (this.state === 'priming') {
      this.enterDemo();
      return;
    }
    if (this.state === 'awaiting-result' || (this.state === 'manual-awaiting-result' && this.resumeReady)) {
      void this.startChoreography(result);
    }
  }

  onCalculationError() {
    if (!this.active) return;
    if (this.state === 'awaiting-result') {
      this.schedule(() => void this.beginRandomCycle(), motion.retryDelayMs);
    } else if (this.state === 'manual-awaiting-result') {
      this.state = 'manual';
      this.resumeReady = false;
    }
  }

  enterDemo() {
    if (!this.active || !this.lastResult) return;
    const routineId = this.startRoutine();
    const neutral = this.getNeutralPosition();
    const endpoint = this.chartView.getClientPosition(this.lastResult.months);
    this.calibrateCursorSpeed(neutral, endpoint);

    this.cursor.style.transitionDuration = '0ms';
    this.cursor.style.transform = `translate3d(${-motion.initialOffscreenOffsetPx}px, ${-motion.initialOffscreenOffsetPx}px, 0)`;
    this.cursor.removeAttribute('hidden');
    this.ring.hidden = true;
    this.cursor.getBoundingClientRect();
    this.state = 'starting';
    this.neutralMovePromise = this.moveCursorTo(neutral, routineId);
    void this.neutralMovePromise.then((arrived) => {
      if (arrived && this.isCurrentRoutine(routineId)) void this.beginRandomCycle();
    });
  }

  calibrateCursorSpeed(start, endpoint) {
    const destination = endpoint || { x: innerWidth * motion.neutralFallbackX, y: innerHeight * motion.neutralFallbackY };
    const approachDistance = distanceBetween(start, destination);
    const approachSpeed = approachDistance / motion.referenceApproachDurationMs;
    const { radius } = this.getOrbitGeometry(destination);
    const orbitDistance = Math.PI * 2 * radius * motion.referenceOrbitTurns;
    const orbitSpeed = orbitDistance / motion.referenceOrbitDurationMs;
    this.cursorSpeedPxPerMs = ((approachSpeed + orbitSpeed) / 2) * motion.cursorSpeedMultiplier;
  }

  async beginRandomCycle() {
    if (!this.active) return;
    const routineId = this.startRoutine();
    this.state = 'typing';
    this.applyingValues = true;
    const scenario = this.createScenario();
    const steps = [
      { element: this.form.elements.incomePeriod, value: 'monthly', type: 'select' },
      { element: this.form.elements.monthlyContribution, value: String(scenario.income), type: 'input' },
      { element: this.form.elements.interestPeriod, value: scenario.interestPeriod, type: 'select' },
      { element: this.form.elements.interestRate, value: scenario.interestRate, type: 'input' },
      { element: this.form.elements.durationUnit, value: scenario.durationUnit, type: 'select' },
      { element: this.form.elements.duration, value: String(scenario.duration), type: 'input' },
    ];

    try {
      for (const step of steps) {
        const completed = step.type === 'select'
          ? await this.setSelect(step.element, step.value, routineId)
          : await this.typeInput(step.element, step.value, routineId);
        if (!completed) return;
      }
    } finally {
      if (this.isCurrentRoutine(routineId)) {
        this.applyingValues = false;
        this.activeAiElement = null;
      }
    }

    if (!this.isCurrentRoutine(routineId)) return;
    this.state = 'awaiting-result';
    this.requestCalculation();
  }

  createScenario() {
    const interestPeriod = this.sequence.nextUnit() < DEMO_CONFIG.randomChoiceThreshold ? 'monthly' : 'annual';
    const durationUnit = interestPeriod === 'monthly' ? 'months' : 'years';
    const annualRatePercent = this.sampleAnnualRatePercent();
    const annualDurationChoices = annualRatePercent > values.durationReductionStartAnnualRatePercent
      ? DEMO_HIGH_RATE_YEAR_CHOICES
      : DEMO_YEAR_CHOICES;
    const randomDuration = durationUnit === 'months'
      ? this.sequence.nextInteger(
        values.minimumEvenMonth / values.durationMonthIncrement,
        values.maximumEvenMonth / values.durationMonthIncrement,
      ) * values.durationMonthIncrement
      : annualDurationChoices[this.sequence.nextInteger(0, annualDurationChoices.length - 1)];
    const duration = this.adjustDurationForAnnualRate(randomDuration, durationUnit, annualRatePercent);
    const incomeSteps = this.sequence.nextInteger(
      values.minimumIncome / values.incomeIncrement,
      values.maximumIncome / values.incomeIncrement,
    );

    return {
      income: incomeSteps * values.incomeIncrement,
      interestPeriod,
      interestRate: interestPeriod === 'annual'
        ? annualRatePercent.toFixed(values.annualRateDecimalPlaces)
        : this.convertAnnualRateToMonthly(annualRatePercent),
      durationUnit,
      duration,
    };
  }

  convertAnnualRateToMonthly(annualRatePercent) {
    const annualRate = annualRatePercent / DEMO_CONFIG.percentToDecimal;
    const monthlyRatePercent = (
      (Math.pow(1 + annualRate, 1 / DEMO_CONFIG.monthsPerYear) - 1)
      * DEMO_CONFIG.percentToDecimal
    );
    return monthlyRatePercent.toFixed(values.monthlyRateDecimalPlaces);
  }

  adjustDurationForAnnualRate(duration, durationUnit, annualRatePercent) {
    if (annualRatePercent <= values.durationReductionStartAnnualRatePercent) return duration;

    const rateStepsAboveThreshold = (
      annualRatePercent - values.durationReductionStartAnnualRatePercent
    ) / values.durationReductionRateStepPercent;
    const reductionPercent = rateStepsAboveThreshold * values.durationReductionPerRateStepPercent;
    const adjustedDuration = duration * (
      1 - reductionPercent / DEMO_CONFIG.percentToDecimal
    );

    if (durationUnit === 'months') {
      const evenMonths = Math.floor(adjustedDuration / values.durationMonthIncrement)
        * values.durationMonthIncrement;
      return Math.max(
        values.minimumEvenMonth,
        Math.min(values.maximumEvenMonth, evenMonths),
      );
    }

    const allowedYears = DEMO_YEAR_CHOICES.filter(
      (year) => year >= values.minimumAnnualDurationYears && year <= adjustedDuration,
    );
    return allowedYears.at(-1) ?? values.minimumAnnualDurationYears;
  }

  sampleAnnualRatePercent() {
    const first = Math.max(Number.EPSILON, this.sequence.nextUnit());
    const second = this.sequence.nextUnit();
    const standardNormal = Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
    const rate = values.annualRateMeanPercent + values.annualRateStandardDeviationPercent * standardNormal;
    const bounded = Math.max(
      values.minimumAnnualRatePercent,
      Math.min(values.maximumAnnualRatePercent, rate),
    );
    const annualRateScale = 10 ** values.annualRateDecimalPlaces;
    return Math.round(bounded * annualRateScale) / annualRateScale;
  }

  async setSelect(element, value, routineId) {
    if (!await this.moveToElement(element, routineId)) return false;
    this.activeAiElement = element;
    element.focus({ preventScroll: true });
    if (element.value !== value) {
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return this.waitFor(motion.selectSettleMs, routineId);
  }

  async typeInput(element, value, routineId) {
    if (!await this.moveToElement(element, routineId)) return false;
    this.activeAiElement = element;
    element.focus({ preventScroll: true });
    const existing = element.value;
    for (let length = existing.length; length > 0; length -= 1) {
      if (!await this.waitFor(motion.typingMsPerCharacter, routineId)) return false;
      element.value = existing.slice(0, length - 1);
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
    for (let length = 1; length <= value.length; length += 1) {
      if (!await this.waitFor(motion.typingMsPerCharacter, routineId)) return false;
      element.value = value.slice(0, length);
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return this.isCurrentRoutine(routineId);
  }

  async startChoreography(result) {
    if (!this.active) return;
    this.clearTimer();
    const routineId = this.routineId;
    this.state = 'approach';
    this.resumeReady = false;
    const endpoint = this.chartView.getClientPosition(result.months);
    if (!endpoint) {
      this.state = 'idle';
      this.schedule(() => void this.beginRandomCycle(), motion.retryDelayMs);
      return;
    }
    if (!await this.moveCursorTo(endpoint, routineId)) return;
    if (!this.isCurrentRoutine(routineId)) return;
    this.state = 'tour';
    this.chartViewModel.selectMonth(result.months);
    this.ring.hidden = false;
    this.placeRing(endpoint.x, endpoint.y);
    this.startOrbit(endpoint, result.months, routineId);
  }

  startOrbit(endpoint, selectedMonth, routineId) {
    const { center, radius } = this.getOrbitGeometry(endpoint);
    const totalDistance = Math.PI * 2 * radius * motion.referenceOrbitTurns;
    let travelled = 0;
    let previousFrame = null;
    this.cursor.style.transitionDuration = '0ms';

    const orbit = (timestamp) => {
      if (!this.isCurrentRoutine(routineId) || this.state !== 'tour') return;
      if (previousFrame !== null) {
        const elapsed = Math.min(timestamp - previousFrame, motion.maximumFrameDeltaMs);
        travelled = Math.min(totalDistance, travelled + this.cursorSpeedPxPerMs * elapsed);
      }
      previousFrame = timestamp;
      const angle = -Math.PI / 2 + travelled / radius;
      this.placeCursor(center.x + Math.cos(angle) * radius, center.y + Math.sin(angle) * radius);
      this.chartViewModel.selectMonth(selectedMonth);
      if (travelled >= totalDistance) {
        this.animation = null;
        void this.finishTour(routineId);
        return;
      }
      this.animation = requestAnimationFrame(orbit);
    };

    this.animation = requestAnimationFrame(orbit);
  }

  async finishTour(routineId) {
    if (!this.isCurrentRoutine(routineId)) return;
    this.state = 'idle';
    this.chartViewModel.clearSelection();
    this.ring.hidden = true;
    const arrived = await this.moveCursorTo(this.getNeutralPosition(), routineId);
    if (!arrived || !this.isCurrentRoutine(routineId)) return;
    this.schedule(() => void this.beginRandomCycle(), motion.neutralPauseMs);
  }

  handleUserActivity(event) {
    if (!this.active) return;
    if (this.applyingValues && !event.isTrusted) return;
    if (this.applyingValues && event.type === 'focusin' && event.target === this.activeAiElement) return;
    this.pauseForUser();
  }

  handleFocusOut() {
    if (!this.active || this.applyingValues || this.state !== 'manual') return;
    this.scheduleUserResume();
  }

  pauseForUser() {
    this.state = 'manual';
    this.resumeReady = false;
    const routineId = this.cancelRoutine();
    this.chartViewModel.clearSelection();
    this.ring.hidden = true;
    this.cursor.removeAttribute('hidden');
    this.neutralMovePromise = this.moveCursorTo(this.getNeutralPosition(), routineId);
    this.scheduleUserResume();
  }

  scheduleUserResume() {
    if (!this.active || this.state !== 'manual') return;
    this.schedule(() => void this.finishManualEdit(), motion.userIdleBeforeResumeMs);
  }

  async finishManualEdit() {
    if (!this.active || this.state !== 'manual') return;
    const focusedControl = document.activeElement?.matches?.('#simulation-form input, #simulation-form select');
    if (focusedControl) {
      this.scheduleUserResume();
      return;
    }

    const routineId = this.routineId;
    if (this.neutralMovePromise && !await this.neutralMovePromise) return;
    if (!this.isCurrentRoutine(routineId) || this.state !== 'manual') return;

    this.state = 'manual-filling';
    this.applyingValues = true;
    const scenario = this.createScenario();
    const missingSteps = this.getMissingSteps(scenario);
    try {
      for (const step of missingSteps) {
        const completed = step.type === 'select'
          ? await this.setSelect(step.element, step.value, routineId)
          : await this.typeInput(step.element, step.value, routineId);
        if (!completed) return;
      }
    } finally {
      if (this.isCurrentRoutine(routineId)) {
        this.applyingValues = false;
        this.activeAiElement = null;
      }
    }

    if (!this.isCurrentRoutine(routineId)) return;
    if (!this.form.reportValidity()) {
      this.state = 'manual';
      return;
    }
    this.resumeReady = true;
    this.state = 'manual-awaiting-result';
    this.requestCalculation();
  }

  getMissingSteps(scenario) {
    const steps = [
      { element: this.form.elements.incomePeriod, value: 'monthly', type: 'select' },
      { element: this.form.elements.monthlyContribution, value: String(scenario.income), type: 'input' },
      { element: this.form.elements.interestPeriod, value: scenario.interestPeriod, type: 'select' },
      { element: this.form.elements.interestRate, value: scenario.interestRate, type: 'input' },
      { element: this.form.elements.durationUnit, value: scenario.durationUnit, type: 'select' },
      { element: this.form.elements.duration, value: String(scenario.duration), type: 'input' },
    ];
    return steps.filter(({ element }) => element.value === '');
  }

  getNeutralPosition() {
    const title = document.querySelector('.timeline-title-wrap')?.getBoundingClientRect();
    const valuesRail = document.querySelector('.results-summary')?.getBoundingClientRect();
    if (!title || !valuesRail || !title.width || !valuesRail.width) {
      return { x: innerWidth * motion.neutralFallbackX, y: innerHeight * motion.neutralFallbackY };
    }
    const x = title.right < valuesRail.left
      ? (title.right + valuesRail.left) / 2
      : (title.left + valuesRail.right) / 2;
    const y = title.bottom < valuesRail.top
      ? (title.bottom + valuesRail.top) / 2
      : valuesRail.bottom < title.top
        ? (valuesRail.bottom + title.top) / 2
        : (title.top + title.bottom + valuesRail.top + valuesRail.bottom) / 4;
    return { x, y };
  }

  getOrbitGeometry(endpoint, bounds = this.chartView.getClientPlotBounds()) {
    if (!bounds) return { center: endpoint, radius: motion.maximumOrbitRadiusPx };
    const center = {
      x: Math.max(bounds.left + motion.plotHorizontalInsetPx, Math.min(bounds.right - motion.plotHorizontalInsetPx, endpoint.x)),
      y: Math.min(endpoint.y, bounds.bottom - motion.plotBottomInsetPx),
    };
    const radius = Math.max(motion.minimumOrbitRadiusPx, Math.min(
      motion.maximumOrbitRadiusPx,
      center.x - bounds.left - motion.minimumOrbitRadiusPx,
      bounds.right - center.x - motion.minimumOrbitRadiusPx,
      center.y - bounds.top - motion.minimumOrbitRadiusPx,
      bounds.bottom - center.y - motion.minimumOrbitRadiusPx,
    ));
    return { center, radius };
  }

  async moveToElement(element, routineId) {
    const bounds = element.getBoundingClientRect();
    return this.moveCursorTo({ x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }, routineId);
  }

  async moveCursorTo(point, routineId) {
    if (!this.isCurrentRoutine(routineId)) return false;
    const bounds = this.cursor.getBoundingClientRect();
    const start = {
      x: bounds.left + motion.cursorHotspotX,
      y: bounds.top + motion.cursorHotspotY,
    };
    const duration = distanceBetween(start, point) / this.cursorSpeedPxPerMs;
    this.cursor.style.transitionDuration = `${duration}ms`;
    this.placeCursor(point.x, point.y);
    return this.waitFor(duration, routineId);
  }

  placeCursor(x, y) {
    this.cursor.style.transform = `translate3d(${x - motion.cursorHotspotX}px, ${y - motion.cursorHotspotY}px, 0)`;
  }

  placeRing(x, y) {
    this.ring.style.left = `${x}px`;
    this.ring.style.top = `${y}px`;
  }

  waitFor(durationMs, routineId) {
    if (!this.isCurrentRoutine(routineId)) return Promise.resolve(false);
    return new Promise((resolve) => {
      const timeoutId = window.setTimeout(() => {
        if (this.pendingWait?.timeoutId === timeoutId) this.pendingWait = null;
        resolve(this.isCurrentRoutine(routineId));
      }, Math.ceil(durationMs));
      this.pendingWait = { timeoutId, resolve };
    });
  }

  isCurrentRoutine(routineId) {
    return this.active && this.routineId === routineId;
  }

  startRoutine() {
    this.cancelRoutine();
    return this.routineId;
  }

  cancelRoutine() {
    this.routineId += 1;
    this.applyingValues = false;
    this.activeAiElement = null;
    this.clearTimer();
    if (this.animation !== null) cancelAnimationFrame(this.animation);
    this.animation = null;
    if (this.pendingWait) {
      const { timeoutId, resolve } = this.pendingWait;
      window.clearTimeout(timeoutId);
      this.pendingWait = null;
      resolve(false);
    }
    return this.routineId;
  }

  schedule(callback, delay) {
    this.clearTimer();
    this.timer = window.setTimeout(() => {
      this.timer = null;
      callback();
    }, delay);
  }

  clearTimer() {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
  }
}

function distanceBetween(start, end) {
  return Math.hypot(end.x - start.x, end.y - start.y);
}
