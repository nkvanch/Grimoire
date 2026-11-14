// Pictures on records, by the desktop's rules: data:image URIs only, no detail picture without an icon, a new icon drops the old detail.
import { picturesOf, withPictures, replaceIcon, pictureBytes } from '../recordPictures';

const icon = 'data:image/png;base64,iVBORw0KGgo=';
const detail = 'data:image/jpeg;base64,/9j/4AAQ';

it('reads only data:image pictures, and no detail picture without an icon', () => {
  expect(picturesOf({ imageUri: icon, imageDetailUri: detail })).toEqual({ imageUri: icon, imageDetailUri: detail });
  expect(picturesOf({ imageUri: 'https://example.com/a.png' })).toEqual({});
  expect(picturesOf({ imageDetailUri: detail })).toEqual({});
  expect(picturesOf(undefined)).toEqual({});
  expect(picturesOf({ imageUri: 'data:image/svg+xml;base64,PHN2Zz4=' })).toEqual({});
});

it('sets exactly the pictures given and keeps every other member of the record', () => {
  const record = { id: 'x', name: 'X', imageUri: icon, imageDetailUri: detail, desktopOnly: { kept: true } };
  expect(withPictures({}, record)).toEqual({ id: 'x', name: 'X', desktopOnly: { kept: true } });
  expect(withPictures({ imageUri: icon }, { id: 'x' })).toEqual({ id: 'x', imageUri: icon });
  expect(withPictures({ imageDetailUri: detail }, { id: 'x' })).toEqual({ id: 'x' });
});

it('a new icon drops the old detail picture, as the desktop needs', () => {
  expect(replaceIcon({ imageUri: icon, imageDetailUri: detail }, 'data:image/png;base64,AAAA')).toEqual({ imageUri: 'data:image/png;base64,AAAA' });
  expect(replaceIcon({ imageUri: icon }, undefined)).toEqual({});
});

it('measures the encoded size', () => {
  expect(pictureBytes('data:image/png;base64,AAAA')).toBe(3);
  expect(pictureBytes('data:image/png;base64,AAA=')).toBe(2);
});
