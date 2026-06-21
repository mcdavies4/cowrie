import * as stripe from './stripe';
import * as flutterwave from './flutterwave';

export function getProvider(rail) {
  if (rail === 'stripe') return stripe;
  if (rail === 'flutterwave') return flutterwave;
  throw new Error(`Unknown rail: ${rail}`);
}
