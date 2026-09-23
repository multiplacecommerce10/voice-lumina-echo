// PRESERVED, NOT IN USE.
//
// These are the PayPal *subscription* plan IDs created before the business
// model moved to one-time prepaid access packages. Recurring PayPal billing
// contradicts the current model, so no PayPal button is rendered anywhere in
// the customer-facing flow. Keep these IDs here until a one-time PayPal Orders
// flow exists, then map them (or their replacements) explicitly.

export const LEGACY_PAYPAL_SUBSCRIPTION_PLANS = {
  live: {
    "1": "P-83B50311XC174031ENH2OWOY",
    "3": "P-31S34058PL511644TNH3O5WI",
    "6": "P-8UT23197GE272604CNH3PK5A",
    "12": "P-4VG65084JS4404322NH3PUNY",
  },
  complete: {
    "1": "P-6BL44529PA8913407NH3OW2A",
    "3": "P-8CU14539NS630574WNH3OONQ",
    "6": "P-8UT23197GE272604CNH3PK5A",
    "12": "P-500961059D378105BNH3PQ3A",
  },
} as const;
