import * as stripe from './stripe';
import * as flutterwave from './flutterwave';
import * as paypal from './paypal';

export function getProvider(rail) {
  if (rail === 'stripe') return stripe;
  if (rail === 'flutterwave') return flutterwave;
  if (rail === 'paypal') return paypal;
  throw new Error(`Unknown rail: ${rail}`);
}
