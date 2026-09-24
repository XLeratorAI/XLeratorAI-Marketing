// Shared reCAPTCHA v3 verification
// RECAPTCHA_SECRET_KEY must be set in Vercel environment variables

async function verifyRecaptcha(token, expectedAction) {
  if (!process.env.RECAPTCHA_SECRET_KEY) {
    console.warn('RECAPTCHA_SECRET_KEY not set — skipping verification');
    return { success: true, score: 1.0 };
  }

  if (!token) {
    return { success: false, score: 0, error: 'Missing reCAPTCHA token' };
  }

  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `secret=${encodeURIComponent(process.env.RECAPTCHA_SECRET_KEY)}&response=${encodeURIComponent(token)}`,
  });

  const data = await res.json();

  // Verify the action matches and score is above threshold
  if (!data.success) {
    return { success: false, score: 0, error: 'reCAPTCHA verification failed' };
  }

  if (expectedAction && data.action !== expectedAction) {
    return { success: false, score: data.score, error: 'reCAPTCHA action mismatch' };
  }

  // Score 0.0 = likely bot, 1.0 = likely human. Threshold 0.5 is Google's recommendation
  if (data.score < 0.5) {
    return { success: false, score: data.score, error: 'Request flagged as suspicious' };
  }

  return { success: true, score: data.score };
}

module.exports = { verifyRecaptcha };
