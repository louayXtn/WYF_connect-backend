const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

async function sendResetPasswordEmail(to, resetLink) {
  await transporter.sendMail({
    from: `"WYF Connect" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'Reset your WYF Connect password',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Reset your password</h2>
        <p>We received a request to reset your WYF Connect password. Click the button below to choose a new one:</p>
        <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background: #111; color: #fff; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          Reset Password
        </a>
        <p>This link will expire in 30 minutes. If you didn't request this, you can safely ignore this email.</p>
      </div>
    `
  });
}

module.exports = { sendResetPasswordEmail };
