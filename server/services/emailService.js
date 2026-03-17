/**
 * Email Service
 * Handles sending transactional emails via SMTP (Nodemailer).
 * Configured for Gmail SMTP as a dev stand-in for campus mail.
 */
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: false, // TLS via STARTTLS (port 587)
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

/**
 * Send a password reset email with a one-time link.
 * @param {string} toEmail - Recipient email address.
 * @param {string} resetToken - The raw reset token (not hashed).
 */
exports.sendPasswordResetEmail = async (toEmail, resetToken) => {
    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;

    await transporter.sendMail({
        from: `"HIT Smart Shade" <${process.env.EMAIL_FROM}>`,
        to: toEmail,
        subject: 'Password Reset Request',
        html: `
            <h2>Password Reset</h2>
            <p>You requested a password reset. Click the link below to set a new password:</p>
            <a href="${resetUrl}">${resetUrl}</a>
            <p>This link expires in <strong>1 hour</strong>.</p>
            <p>If you did not request this, ignore this email.</p>
        `,
    });
};