const DEFAULT_DEBOUNCE_MS = 360;

/** Coordinates calculator input, request state, and result events. */
export class CalculatorViewModel {
  constructor({
    form,
    client,
    onResult,
    onError,
    onLoading,
    isApplyingAutomatedInput = () => false,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    windowRef = globalThis.window,
  }) {
    this.form = form;
    this.client = client;
    this.onResult = onResult;
    this.onError = onError;
    this.onLoading = onLoading;
    this.isApplyingAutomatedInput = isApplyingAutomatedInput;
    this.debounceMs = debounceMs;
    this.windowRef = windowRef;
    this.status = 'idle';
    this.latestRequest = 0;
    this.timer = null;
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleInput = this.handleInput.bind(this);
    this.handleChange = this.handleChange.bind(this);
  }

  bind() {
    this.form.addEventListener('submit', this.handleSubmit);
    this.form.addEventListener('input', this.handleInput);
    this.form.querySelectorAll('select').forEach((select) => {
      select.addEventListener('change', this.handleChange);
    });
  }

  dispose() {
    this.form.removeEventListener('submit', this.handleSubmit);
    this.form.removeEventListener('input', this.handleInput);
    this.form.querySelectorAll('select').forEach((select) => {
      select.removeEventListener('change', this.handleChange);
    });
    this.windowRef.clearTimeout(this.timer);
  }

  async handleSubmit(event) {
    event.preventDefault();
    this.windowRef.clearTimeout(this.timer);
    this.onError('');
    const requestId = ++this.latestRequest;
    this.status = 'loading';
    this.onLoading(true);

    try {
      const result = await this.client.simulate(this.readInput());
      if (requestId !== this.latestRequest) return;
      this.status = 'success';
      this.onResult(result);
    } catch (error) {
      if (requestId !== this.latestRequest) return;
      this.status = 'error';
      this.onError(error.message || 'ERROR_NETWORK');
    } finally {
      if (requestId === this.latestRequest) this.onLoading(false);
    }
  }

  readInput() {
    return {
      income: this.form.elements.monthlyContribution.value,
      incomePeriod: this.form.elements.incomePeriod.value,
      interestRate: this.form.elements.interestRate.value,
      interestPeriod: this.form.elements.interestPeriod.value,
      duration: this.form.elements.duration.value,
      durationUnit: this.form.elements.durationUnit.value,
    };
  }

  handleInput() {
    if (!this.isApplyingAutomatedInput()) this.scheduleCalculation();
  }

  handleChange() {
    if (!this.isApplyingAutomatedInput()) this.scheduleCalculation();
  }

  scheduleCalculation() {
    this.windowRef.clearTimeout(this.timer);
    this.timer = this.windowRef.setTimeout(() => {
      this.timer = null;
      if (this.form.checkValidity()) this.form.requestSubmit();
    }, this.debounceMs);
  }
}
