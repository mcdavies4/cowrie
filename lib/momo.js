// Mobile money networks per country, with the Flutterwave transfer `account_bank` code.
// Kenya M-Pesa ("MPS") is confirmed from Flutterwave's docs. The other network codes
// are best-effort and MUST be confirmed in Flutterwave test mode before going live —
// codes vary and Flutterwave occasionally changes them. Country code is the FLW country.

export const MOMO_NETWORKS = {
  KE: [{ value: 'MPS', label: 'M-Pesa' }],
  UG: [
    { value: 'MTN', label: 'MTN Mobile Money' },
    { value: 'AIRTEL', label: 'Airtel Money' },
  ],
  TZ: [
    { value: 'VODAFONE', label: 'Vodacom M-Pesa' },
    { value: 'TIGO', label: 'Tigo Pesa' },
    { value: 'AIRTEL', label: 'Airtel Money' },
  ],
  GH: [
    { value: 'MTN', label: 'MTN MoMo' },
    { value: 'VODAFONE', label: 'Telecel (Vodafone)' },
    { value: 'AIRTELTIGO', label: 'AirtelTigo' },
  ],
};

// Dialing code per FLW country, used to normalise phone numbers (FLW accepts
// 254700000000 or 0700000000 forms for M-Pesa).
export const DIAL_CODE = { KE: '254', UG: '256', TZ: '255', GH: '233' };

export function networksForCountry(cc) {
  return MOMO_NETWORKS[cc] || [];
}
