const nodemailer = require('nodemailer');

const email = options => {
  // 1) Create a Transporter.
  const transporter = nodemailer.Transport({
    service: 'Gmail',
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD
    }
    // Activate in gamil "less secure app" option
  });

  // 2) Define the email options.

  // 3) Actually send the email.
};
