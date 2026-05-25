export interface WelcomeTemplateVars {
  name: string
  email: string
}

export function welcomeTemplate(vars: WelcomeTemplateVars): {
  subject: string
  html: string
} {
  return {
    subject: "Welcome to SaaS Billing!",
    html: `
<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /></head>
  <body style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 24px;">
    <h1 style="font-size: 24px; margin-bottom: 16px;">Welcome, ${vars.name}!</h1>
    <p>Your account (<strong>${vars.email}</strong>) has been created successfully.</p>
    <p>You are on the <strong>Free</strong> plan. Upgrade any time from your dashboard.</p>
    <p style="margin-top: 32px; color: #888; font-size: 12px;">
      You received this email because an account was created with this address.
    </p>
  </body>
</html>
    `.trim(),
  }
}
