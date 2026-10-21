/** Renders the four headline outcomes as a compact, accessible result rail. */
export class InvestmentResultsView {
  constructor(elements, formatters) {
    this.elements = elements;
    this.formatters = formatters;
  }

  render(result) {
    this.elements.initial.textContent = this.formatters.currency(result.initialPatrimony);
    this.setCurrency(this.elements.contributions, result.totalContributions);
    this.setCurrency(this.elements.interest, result.interestEarned);
    const compact = window.matchMedia('(max-width: 700px)').matches;
    const fullPercent = `${this.formatters.percent(result.growthPercent)}%`;
    this.elements.growth.textContent = compact
      ? `${this.formatters.compactPercent(result.growthPercent)}%`
      : fullPercent;
    this.elements.growth.title = compact ? fullPercent : '';
    this.setCurrency(this.elements.final, result.finalPatrimony);
    this.elements.duration.textContent = this.formatters.duration(result.duration, result.durationUnit);
    this.elements.period.textContent = this.formatters.duration(result.duration, result.durationUnit);
  }

  setCurrency(element, value) {
    const full = this.formatters.currency(value);
    const compact = window.matchMedia('(max-width: 700px)').matches;
    element.textContent = compact ? this.formatters.compactCurrency(value) : full;
    element.title = compact ? full : '';
  }
}
