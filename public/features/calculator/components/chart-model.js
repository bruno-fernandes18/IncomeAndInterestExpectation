const SVG_HEIGHT = 430;

/** Pure chart data and scale model. It has no dependency on the DOM. */
export class InvestmentChartModel {
  constructor(result) {
    this.result = result;
    this.points = Array.isArray(result.timeline) ? result.timeline : [];
    this.selectedMonth = result.months;
    this.lastMonth = Math.max(this.points.at(-1)?.month ?? result.months, 1);
    this.selectedPoint = this.getPoint(this.selectedMonth);
    this.maxBalance = Math.max(1, this.points.reduce((highest, point) => Math.max(highest, point.balance), 0));
    this.displayMaxBalance = this.maxBalance * 1.08;
    this.reflow(1100, SVG_HEIGHT);
  }

  reflow(width, height = SVG_HEIGHT) {
    this.width = width;
    this.height = height;
    const compact = width < 620;
    this.margin = compact
      ? { top: 23, right: 12, bottom: 43, left: 70 }
      : { top: 24, right: 20, bottom: 48, left: 92 };
    this.axisY = height - this.margin.bottom;
    this.plotWidth = width - this.margin.left - this.margin.right;
    this.plotHeight = this.axisY - this.margin.top;
    this.plotTop = this.margin.top;
    this.plotLeft = this.margin.left;
    this.plotRight = width - this.margin.right;
  }

  getPoint(month) {
    if (!this.points.length) return null;
    const clamped = Math.max(0, Math.min(this.points.at(-1).month, Math.round(month)));
    return this.points[clamped] ?? this.points.reduce((nearest, point) =>
      Math.abs(point.month - clamped) < Math.abs(nearest.month - clamped) ? point : nearest,
    this.points[0]);
  }

  x(month) {
    return this.margin.left + (Math.max(0, Math.min(this.lastMonth, month)) / this.lastMonth) * this.plotWidth;
  }

  y(balance) {
    return this.margin.top + this.plotHeight - (balance / this.displayMaxBalance) * this.plotHeight;
  }

  monthAtX(xPosition) {
    const fraction = Math.max(0, Math.min(1, (xPosition - this.margin.left) / this.plotWidth));
    return Math.round(fraction * this.lastMonth);
  }

  get selectedPoints() {
    return this.points.filter((point) => point.month <= this.selectedMonth);
  }

  get projectionPoints() {
    return this.points.filter((point) => point.month >= this.selectedMonth);
  }

  path(points) {
    return points.map((point, index) =>
      `${index === 0 ? 'M' : 'L'} ${this.x(point.month).toFixed(2)} ${this.y(point.balance).toFixed(2)}`,
    ).join(' ');
  }

  areaPath(points) {
    if (!points.length) return '';
    const first = points[0];
    const last = points.at(-1);
    return `${this.path(points)} L ${this.x(last.month).toFixed(2)} ${this.axisY} L ${this.x(first.month).toFixed(2)} ${this.axisY} Z`;
  }

  get yTicks() {
    return Array.from({ length: 5 }, (_, index) => {
      const fraction = index / 4;
      const balance = this.displayMaxBalance * (1 - fraction);
      return { y: this.plotTop + fraction * this.plotHeight, balance };
    });
  }

  get xTicks() {
    return Array.from({ length: 5 }, (_, index) => {
      const month = Math.round((this.lastMonth * index) / 4);
      return { month, x: this.x(month) };
    });
  }
}
