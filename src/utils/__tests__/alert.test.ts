import { Alert as RNAlert } from 'react-native';
import { reportFailure } from '../alert';

it('reportFailure shows what failed and why, for an Error and for any other thrown value', async () => {
  const shown = jest.spyOn(RNAlert, 'alert').mockImplementation(() => {});
  await Promise.reject(new Error('disk full')).catch(reportFailure('save the item'));
  reportFailure('join the session')('timeout');
  expect(shown.mock.calls.map(c => c.slice(0, 2))).toEqual([['Could not save the item', 'disk full'], ['Could not join the session', 'timeout']]);
});
