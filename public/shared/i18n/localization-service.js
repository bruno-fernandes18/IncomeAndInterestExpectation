import { LOCALES, LOCALE_BY_ID } from './locale-config.js';

/** Loads localized copy and exposes a small, framework independent lookup API. */
export class LocalizationService {
  constructor(fetcher = globalThis.fetch) {
    this.fetcher = fetcher;
    this.catalogs = Object.create(null);
    this.locale = 'en';
  }

  async load() {
    const entries = await Promise.all(LOCALES.map(async ({ id }) => {
      const response = await this.fetcher(`/locales/${id}.json`);
      if (!response.ok) throw new Error('LOCALE_LOAD_FAILED');
      return [id, await response.json()];
    }));
    this.catalogs = Object.fromEntries(entries);
  }

  setLocale(locale) {
    this.locale = LOCALE_BY_ID[locale] && this.catalogs[locale] ? locale : 'en';
    return this.locale;
  }

  get config() {
    return LOCALE_BY_ID[this.locale];
  }

  text(key) {
    return this.catalogs[this.locale]?.[key] || this.catalogs.en?.[key] || key;
  }

  template(key, values = {}) {
    return Object.entries(values).reduce(
      (copy, [name, value]) => copy.replaceAll(`{${name}}`, String(value)),
      this.text(key),
    );
  }
}
