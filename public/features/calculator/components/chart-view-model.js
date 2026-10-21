import { InvestmentChartModel } from './chart-model.js';

/** Coordinates chart state and presentation without owning SVG or browser events. */
export class InvestmentChartViewModel {
  #model = null;
  #activeMonth = null;
  #listeners = new Set();

  subscribe(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  setResult(result) {
    this.#model = new InvestmentChartModel(result);
    this.#activeMonth = null;
    this.#notify('result');
  }

  selectMonth(month) {
    if (!this.#model) return;
    const point = this.#model.getPoint(month);
    if (!point || point.month === this.#activeMonth) return;
    this.#activeMonth = point.month;
    this.#notify('selection');
  }

  clearSelection() {
    if (this.#activeMonth === null) return;
    this.#activeMonth = null;
    this.#notify('selection');
  }

  get model() { return this.#model; }
  get activeMonth() { return this.#activeMonth; }
  get activePoint() { return this.#activeMonth === null ? null : this.#model?.getPoint(this.#activeMonth); }
  get selectedPoint() { return this.#model?.selectedPoint; }

  #notify(type) {
    const state = { type, model: this.#model, activeMonth: this.#activeMonth, activePoint: this.activePoint };
    for (const listener of this.#listeners) listener(state);
  }
}
