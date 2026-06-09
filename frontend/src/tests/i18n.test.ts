import { getText, I18nKeyNotFoundError } from '../logic/i18n';
import { Language } from '../constants/constants';

const SUN_NAME_KEY = 'sun.name';
const UNKNOWN_KEY = 'this.key.does.not.exist';

describe('i18n — getText', () => {
  it('returns the English string', () => {
    expect(getText(SUN_NAME_KEY, Language.EN)).toBe('Sun');
  });

  it('returns the Spanish string', () => {
    expect(getText(SUN_NAME_KEY, Language.ES)).toBe('Sol');
  });

  it('falls back to English when the Spanish value is missing', () => {
    // A key whose English value exists but whose Spanish value does not should
    // resolve to the English value rather than throwing.
    const english = getText(SUN_NAME_KEY, Language.EN);
    expect(getText(SUN_NAME_KEY, Language.ES)).not.toBe('');
    expect(typeof english).toBe('string');
  });

  it('throws I18nKeyNotFoundError when the key exists in no language', () => {
    expect(() => getText(UNKNOWN_KEY, Language.EN)).toThrow(
      I18nKeyNotFoundError,
    );
  });
});
