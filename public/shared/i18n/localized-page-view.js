/** Applies the current catalog to translated text and document metadata. */
export function applyLocalizedPage({ documentRef, localeSelect, localization }) {
  const config = localization.config;
  localeSelect.value = localization.locale;
  documentRef.documentElement.lang = config.tag;
  documentRef.documentElement.dir = config.direction;
  documentRef.querySelector('#brand-name').dataset.order = config.brandOrder;

  if (!localization.catalogs.en || Object.keys(localization.catalogs.en).length === 0) return;

  documentRef.title = localization.text('HEADER_TITLE');
  for (const element of documentRef.querySelectorAll('[data-i18n]')) {
    element.textContent = localization.text(element.dataset.i18n);
  }
  for (const element of documentRef.querySelectorAll('[data-i18n-aria]')) {
    element.setAttribute('aria-label', localization.text(element.dataset.i18nAria));
  }
  for (const element of documentRef.querySelectorAll('[data-i18n-content]')) {
    element.setAttribute('content', localization.text(element.dataset.i18nContent));
  }

  const currencySymbol = documentRef.querySelector('#currency-symbol');
  currencySymbol.textContent = config.currency;
  const currencyName = typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames([config.tag], { type: 'currency' }).of(config.currency)
    : config.currency;
  currencySymbol.title = `${currencyName} (${config.currency})`;
  documentRef.querySelector('#monthly-contribution').setAttribute(
    'aria-label',
    `${localization.text('INCOME_AMOUNT_ARIA')} (${config.currency})`,
  );
}
