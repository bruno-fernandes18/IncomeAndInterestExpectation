const ALLOWED_VIEWS = new Set(['home', 'how', 'example']);

/** Coordinates hash navigation and view visibility, including example lifecycle. */
export class NavigationViewModel {
  constructor({
    form,
    calculatorPanel,
    methodPanel,
    demoPill,
    getDemoController,
    onExampleExit,
    documentRef = globalThis.document,
    windowRef = globalThis.window,
  }) {
    this.form = form;
    this.calculatorPanel = calculatorPanel;
    this.methodPanel = methodPanel;
    this.demoPill = demoPill;
    this.getDemoController = getDemoController;
    this.onExampleExit = onExampleExit;
    this.documentRef = documentRef;
    this.windowRef = windowRef;
    this.activeView = 'home';
    this.savedHomeValues = null;
    this.handlePopState = () => this.switchView(this.viewFromHash(), false);
    this.handleLinkClick = this.handleLinkClick.bind(this);
  }

  bind() {
    this.documentRef.querySelectorAll('[data-view-link]').forEach((link) => {
      link.addEventListener('click', this.handleLinkClick);
    });
    this.windowRef.addEventListener('popstate', this.handlePopState);
  }

  dispose() {
    this.documentRef.querySelectorAll('[data-view-link]').forEach((link) => {
      link.removeEventListener('click', this.handleLinkClick);
    });
    this.windowRef.removeEventListener('popstate', this.handlePopState);
  }

  handleLinkClick(event) {
    event.preventDefault();
    this.switchView(event.currentTarget.dataset.viewLink);
  }

  switchView(view, updateAddress = true) {
    const destination = ALLOWED_VIEWS.has(view) ? view : 'home';
    const previousView = this.activeView;

    if (previousView !== 'example' && destination === 'example') {
      this.savedHomeValues = this.captureFormValues();
    }
    if (previousView === 'example' && destination !== 'example') {
      this.getDemoController()?.stop();
      if (this.savedHomeValues) this.restoreFormValues(this.savedHomeValues);
    }

    this.activeView = destination;
    this.calculatorPanel.hidden = destination === 'how';
    this.methodPanel.hidden = destination !== 'how';
    for (const link of this.documentRef.querySelectorAll('[data-view-link]')) {
      if (link.dataset.viewLink === destination) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    this.demoPill.hidden = destination !== 'example';

    if (updateAddress) this.windowRef.history.pushState({ view: destination }, '', `#${this.viewHash(destination)}`);
    if (previousView !== 'example' && destination === 'example') this.getDemoController()?.start();
    if (previousView === 'example' && destination !== 'example' && this.savedHomeValues) {
      this.savedHomeValues = null;
      this.onExampleExit();
    }
  }

  setInitialView() {
    this.switchView(this.viewFromHash(), false);
  }

  captureFormValues() {
    return Object.fromEntries([...this.form.elements]
      .filter((element) => element.name)
      .map((element) => [element.name, element.value]));
  }

  restoreFormValues(values) {
    for (const [name, value] of Object.entries(values)) {
      const field = this.form.elements[name];
      if (field) field.value = value;
    }
  }

  viewHash(view) {
    return view === 'how' ? 'how-its-calculated' : view;
  }

  viewFromHash() {
    if (this.windowRef.location.hash === '#how-its-calculated') return 'how';
    if (this.windowRef.location.hash === '#example') return 'example';
    return 'home';
  }
}
