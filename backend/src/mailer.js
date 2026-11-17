import nodemailer from 'nodemailer';

// SMTP apa saja: Gmail (App Password), Brevo, Resend, Mailgun, dll.
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;
const port = Number(SMTP_PORT || 465);

export const mailEnabled = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

let transporter;
function transport() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      // Batas waktu ketat: function serverless maksimal ±10 detik
      connectionTimeout: 6000,
      greetingTimeout: 6000,
      socketTimeout: 8000,
    });
  }
  return transporter;
}

export async function sendMail(message) {
  if (!mailEnabled) {
    const err = new Error('Email belum dikonfigurasi');
    err.code = 'MAIL_DISABLED';
    throw err;
  }
  return transport().sendMail({ from: MAIL_FROM || SMTP_USER, ...message });
}
