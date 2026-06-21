// Claim a webhook event id so we process it exactly once.
// Returns true if this is the first time we've seen it, false if it's a duplicate.
export async function claimEvent(db, key) {
  const { error } = await db.from('webhook_events').insert({ provider_ref: key });
  if (error) {
    if (error.code === '23505') return false; // unique violation = already processed
    console.error('claimEvent unexpected error:', error.message);
    return true; // don't block processing on an unexpected error
  }
  return true;
}

// Release a claim so the provider's retry can re-attempt (call this if processing failed).
export async function releaseEvent(db, key) {
  await db.from('webhook_events').delete().eq('provider_ref', key);
}
