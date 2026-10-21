const SVG_NS = 'http://www.w3.org/2000/svg';

/** SVG renderer and pointer adapter for the investment chart component. */
export class InvestmentChartView {
  constructor(svg, viewModel, formatters) {
    this.svg = svg;
    this.viewModel = viewModel;
    this.formatters = formatters;
    this.model = null;
    this.unsubscribe = viewModel.subscribe((state) => {
      if (state.type === 'result') this.render(state.model);
      else this.renderSelection(state.activePoint);
    });
    this.svg.addEventListener('pointermove', (event) => this.onPointerMove(event));
    this.svg.addEventListener('pointerleave', () => viewModel.clearSelection());
    this.resizeObserver = new ResizeObserver(() => {
      if (this.model && !this.svg.closest('[hidden]')) this.render(this.model);
    });
    this.resizeObserver.observe(this.svg.parentElement);
  }

  render(model) {
    this.model = model;
    const bounds = this.svg.getBoundingClientRect();
    const ratio = bounds.height > 0 ? bounds.width / bounds.height : 1100 / 430;
    model.reflow(Math.max(400, 430 * ratio), 430);
    this.svg.replaceChildren();
    this.svg.setAttribute('viewBox', `0 0 ${model.width} ${model.height}`);
    this.svg.setAttribute('preserveAspectRatio', 'none');
    this.svg.setAttribute('aria-label', this.formatters.chartAria(model.result));
    this.renderDefinitions();
    this.renderGrid();
    this.renderAxes();
    this.renderTimeline();
    this.renderInteractionSurface();
    this.renderSelection(this.viewModel.activePoint);
  }

  renderDefinitions() {
    const defs = addSvg(this.svg, 'defs');
    const gradient = addSvg(defs, 'linearGradient', { id: 'balance-fill', x1: '0', x2: '0', y1: '0', y2: '1' });
    addSvg(gradient, 'stop', { offset: '0%', 'stop-color': '#189d4d', 'stop-opacity': '.13' });
    addSvg(gradient, 'stop', { offset: '100%', 'stop-color': '#189d4d', 'stop-opacity': '0' });
  }

  renderGrid() {
    for (const tick of this.model.yTicks.slice(1, -1)) {
      addSvg(this.svg, 'line', {
        x1: this.model.plotLeft,
        y1: tick.y,
        x2: this.model.plotRight,
        y2: tick.y,
        class: 'chart-grid-line',
      });
    }
    for (const tick of this.model.yTicks) {
      const label = addSvg(this.svg, 'text', {
        x: this.model.plotLeft - 14,
        y: tick.y + 4,
        'text-anchor': 'end',
        class: 'chart-axis-label',
      });
      label.textContent = this.formatters.compactCurrency(tick.balance);
    }
    for (const tick of this.model.xTicks) {
      const mark = addSvg(this.svg, 'line', {
        x1: tick.x,
        y1: this.model.axisY,
        x2: tick.x,
        y2: this.model.axisY + 6,
        class: 'chart-tick',
      });
      const label = addSvg(this.svg, 'text', {
        x: tick.x,
        y: this.model.axisY + 22,
        'text-anchor': tick.x === this.model.plotLeft ? 'start' : tick.x === this.model.plotRight ? 'end' : 'middle',
        class: 'chart-x-label',
      });
      label.textContent = this.formatters.axisMonth(tick.month);
      mark.setAttribute('aria-hidden', 'true');
    }
  }

  renderAxes() {
    addSvg(this.svg, 'line', {
      x1: this.model.plotLeft,
      y1: this.model.plotTop,
      x2: this.model.plotLeft,
      y2: this.model.axisY,
      class: 'chart-axis-line',
    });
    addSvg(this.svg, 'line', {
      x1: this.model.plotLeft,
      y1: this.model.axisY,
      x2: this.model.plotRight,
      y2: this.model.axisY,
      class: 'chart-axis-line',
    });
  }

  renderTimeline() {
    const mainPoints = this.model.selectedPoints;
    const futurePoints = this.model.projectionPoints;
    const selectedX = this.model.x(this.model.selectedMonth);
    if (this.model.result.projectionMonths > 0) {
      addSvg(this.svg, 'line', {
        x1: selectedX,
        y1: this.model.plotTop + 8,
        x2: selectedX,
        y2: this.model.axisY,
        class: 'chart-selected-line',
      });
    }
    if (mainPoints.length) {
      addSvg(this.svg, 'path', { d: this.model.areaPath(mainPoints), class: 'chart-balance-area' });
      addSvg(this.svg, 'path', { d: this.model.path(mainPoints), class: 'chart-balance-path' });
    }
    if (futurePoints.length > 1) {
      addSvg(this.svg, 'path', { d: this.model.path(futurePoints), class: 'chart-future-path' });
      const futureEnd = futurePoints.at(-1);
      addSvg(this.svg, 'circle', { cx: this.model.x(futureEnd.month), cy: this.model.y(futureEnd.balance), r: 4, class: 'chart-future-endpoint' });
    }
    if (this.model.selectedPoint) {
      addSvg(this.svg, 'circle', {
        cx: selectedX,
        cy: this.model.y(this.model.selectedPoint.balance),
        r: 5.5,
        class: 'chart-endpoint',
      });
    }
  }

  renderInteractionSurface() {
    addSvg(this.svg, 'rect', {
      x: this.model.plotLeft,
      y: this.model.plotTop,
      width: this.model.plotWidth,
      height: this.model.plotHeight,
      class: 'chart-interaction',
      'aria-hidden': 'true',
    });
  }

  renderSelection(point) {
    this.svg.querySelector('.chart-hover')?.remove();
    if (!this.model || !point) return;
    const group = addSvg(this.svg, 'g', { class: 'chart-hover', 'aria-hidden': 'true' });
    const x = this.model.x(point.month);
    const y = this.model.y(point.balance);
    addSvg(group, 'line', { x1: x, y1: this.model.plotTop, x2: x, y2: this.model.axisY, class: 'chart-hover-line' });
    addSvg(group, 'circle', { cx: x, cy: y, r: 6, class: 'chart-hover-dot' });

    const width = Math.min(240, this.model.plotWidth * .56);
    const height = 87;
    const tooltipX = Math.max(this.model.plotLeft + 6, Math.min(this.model.plotRight - width - 4, x + 16));
    const tooltipY = y - height - 14 < this.model.plotTop ? y + 14 : y - height - 14;
    addSvg(group, 'rect', { x: tooltipX, y: tooltipY, width, height, rx: 9, class: 'chart-tooltip-box' });
    const monthTitle = addSvg(group, 'text', { x: tooltipX + 13, y: tooltipY + 19, class: 'chart-tooltip-kicker' });
    monthTitle.textContent = this.formatters.pointMonth(point.month);
    const balance = addSvg(group, 'text', { x: tooltipX + 13, y: tooltipY + 41, class: 'chart-tooltip-value' });
    balance.textContent = this.formatters.currency(point.balance);
    addSvg(balance, 'title').textContent = this.formatters.fullCurrency(point.balance);
    const contributions = addSvg(group, 'text', { x: tooltipX + 13, y: tooltipY + 63, class: 'chart-tooltip-detail' });
    contributions.textContent = this.formatters.tooltipContributions(point);
    addSvg(contributions, 'title').textContent = this.formatters.fullCurrency(point.contributions);
    const interest = addSvg(group, 'text', { x: tooltipX + 13, y: tooltipY + 77, class: 'chart-tooltip-detail' });
    interest.textContent = this.formatters.tooltipInterest(point);
    addSvg(interest, 'title').textContent = this.formatters.fullCurrency(point.balance - point.contributions);
  }

  onPointerMove(event) {
    if (!this.model) return;
    const matrix = this.svg.getScreenCTM();
    if (!matrix) return;
    const pointer = this.svg.createSVGPoint();
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    const local = pointer.matrixTransform(matrix.inverse());
    if (local.x < this.model.plotLeft || local.x > this.model.plotRight || local.y < this.model.plotTop || local.y > this.model.axisY) {
      this.viewModel.clearSelection();
      return;
    }
    this.viewModel.selectMonth(this.model.monthAtX(local.x));
  }

  getClientPosition(month = this.model?.selectedMonth) {
    if (!this.model || month === null || month === undefined) return null;
    const point = this.model.getPoint(month);
    if (!point) return null;
    const svgPoint = this.svg.createSVGPoint();
    svgPoint.x = this.model.x(point.month);
    svgPoint.y = this.model.y(point.balance);
    const screen = svgPoint.matrixTransform(this.svg.getScreenCTM());
    return { x: screen.x, y: screen.y, month: point.month };
  }

  getClientPlotBounds() {
    if (!this.model) return null;
    const matrix = this.svg.getScreenCTM();
    if (!matrix) return null;
    const topLeft = this.svg.createSVGPoint();
    topLeft.x = this.model.plotLeft;
    topLeft.y = this.model.plotTop;
    const bottomRight = this.svg.createSVGPoint();
    bottomRight.x = this.model.plotRight;
    bottomRight.y = this.model.axisY;
    const top = topLeft.matrixTransform(matrix);
    const bottom = bottomRight.matrixTransform(matrix);
    return { left: top.x, top: top.y, right: bottom.x, bottom: bottom.y };
  }
}

function addSvg(parent, name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  parent.append(element);
  return element;
}
