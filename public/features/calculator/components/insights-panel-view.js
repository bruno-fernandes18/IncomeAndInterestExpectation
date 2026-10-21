/** Cycles through a few calculation-specific notes rather than repeating one trivia. */
const MONTHS_PER_YEAR = 12;
const PERCENT_TO_DECIMAL = 100;

export class InvestmentInsightsView {
  constructor(elements, formatters, text, template) {
    this.elements = elements;
    this.formatters = formatters;
    this.text = text;
    this.template = template;
    this.facts = [];
    this.index = 0;
    this.elements.next.addEventListener('click', () => this.show((this.index + 1) % Math.max(this.facts.length, 1)));
  }

  update(result) {
    const monthlyRate = result.monthlyRatePercent;
    const annualRate = Math.expm1(MONTHS_PER_YEAR * Math.log1p(monthlyRate / PERCENT_TO_DECIMAL)) * PERCENT_TO_DECIMAL;
    const rateCopy = result.interestPeriod === 'annual'
      ? this.template('INSIGHT_RATE_ANNUAL_COPY', {
        annual: this.formatters.percent(result.interestRatePercent),
      })
      : this.template('INSIGHT_RATE_COPY', {
        annual: this.formatters.percent(annualRate),
        monthly: this.formatters.percent(monthlyRate),
      });
    const interestShare = result.finalPatrimony > 0
      ? (result.interestEarned / result.finalPatrimony) * 100
      : 0;
    const projectionGain = result.finalPatrimony > 0
      ? (result.projectionAdditionalValue / result.finalPatrimony) * 100
      : 0;
    const unit = this.formatters.unit(result.projectionDuration, result.durationUnit);
    this.facts = [
      {
        topic: 'INSIGHT_TOPIC_TIME',
        copy: result.projectionDuration && !result.projectionUnavailable
          ? this.template('INSIGHT_PROJECTION_COPY', {
            duration: result.projectionDuration,
            unit,
            percent: this.formatters.percent(projectionGain),
            value: this.formatters.currency(result.projectionFinalPatrimony),
          })
          : this.text('INSIGHT_TIME_COPY'),
      },
      {
        topic: 'INSIGHT_TOPIC_RATE',
        copy: rateCopy,
      },
      {
        topic: 'INSIGHT_TOPIC_COMPOUND',
        copy: this.template('INSIGHT_COMPOUND_COPY', {
          percent: this.formatters.percent(interestShare),
          interest: this.formatters.currency(result.interestEarned),
        }),
      },
    ];
    this.index = this.facts.length > 1 ? (this.index + 1) % this.facts.length : 0;
    this.show(this.index);
  }

  show(index) {
    if (!this.facts.length) return;
    this.index = (index + this.facts.length) % this.facts.length;
    const fact = this.facts[this.index];
    this.elements.kicker.textContent = this.text(fact.topic);
    this.elements.copy.textContent = fact.copy;
    this.elements.count.textContent = `${String(this.index + 1).padStart(2, '0')} / ${String(this.facts.length).padStart(2, '0')}`;
  }
}
