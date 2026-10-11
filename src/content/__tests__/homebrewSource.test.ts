// The source a creator records on homebrew (name and optional link) and what the library shows of it.
import { sourceOf } from '../homebrewLibrary';
import { cleanOrigin } from '../../components/homebrew/OriginFields';

describe('sourceOf', () => {
  it('returns the name and a web link', () => {
    expect(sourceOf({ origin: { name: ' Reddit: Storm Smith ', link: ' https://example.com/post ' } })).toEqual({ name: 'Reddit: Storm Smith', link: 'https://example.com/post' });
  });
  it('keeps a name with no link', () => {
    expect(sourceOf({ origin: { name: 'Homebrew Book' } })).toEqual({ name: 'Homebrew Book' });
  });
  it('drops a link that is not a web address, so tapping it can never run anything', () => {
    expect(sourceOf({ origin: { name: 'x', link: 'javascript:alert(1)' } })).toEqual({ name: 'x' });
    expect(sourceOf({ origin: { name: 'x', link: 'file:///etc/passwd' } })).toEqual({ name: 'x' });
  });
  it('is null when nothing was recorded', () => {
    expect(sourceOf({})).toBeNull();
    expect(sourceOf({ origin: { name: '   ' } })).toBeNull();
  });
});

describe('cleanOrigin', () => {
  it('trims, and returns undefined when both fields are empty', () => {
    expect(cleanOrigin({ name: '  Book  ', link: ' https://a.b ' })).toEqual({ name: 'Book', link: 'https://a.b' });
    expect(cleanOrigin({ name: ' ', link: '' })).toBeUndefined();
    expect(cleanOrigin(undefined)).toBeUndefined();
  });
  it('uses the link as the name when only a link was given', () => {
    expect(cleanOrigin({ name: '', link: 'https://a.b/c' })).toEqual({ name: 'https://a.b/c' });
  });
});
