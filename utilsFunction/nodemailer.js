const nodemailer = require("nodemailer");
const EmailVerification = require("../model/emailVerificationModel");

// Create a nodemailer transporter
const transporter = nodemailer.createTransport({
  secure: true,
  host: "smtp.gmail.com",
  port: 465,
  auth: {
    user: "jibandon12345@gmail.com",
    pass: "oawvcpfxvpdqxgey",
  },
});

// Function to send OTP to email
const sendOtpToEmail = async ({ email, otp }) => {
  console.log(email);
  const mailOptions = {
    from: `Dostana`,
    to: email,
    subject: "Your OTP Code",
    html: `
    <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SMS Notification</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
            color: #333;
        }
        .email-container {
            max-width: 600px;
            margin: 20px auto;
            background: #ffffff;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .header {
            background: #4CAF50;
            color: white;
            text-align: center;
            padding: 20px;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
        }
        .content {
            padding: 20px;
            text-align: center;
        }
        .content p {
            font-size: 16px;
            line-height: 1.5;
        }
        .cta-button {
            display: inline-block;
            margin-top: 20px;
            padding: 10px 20px;
            color: white;
            background-color: #4CAF50;
            text-decoration: none;
            border-radius: 4px;
            font-size: 16px;
        }
        .footer {
            background: #f4f4f4;
            color: #777;
            text-align: center;
            font-size: 12px;
            padding: 10px;
            border-top: 1px solid #ddd;
        }
        .footer a {
            color: #4CAF50;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>Dostana</h1>
        </div>
        <div class="content">
            <p>Hello ${email},</p>
            <p>We are sending you this SMS notification via <strong>Dostana</strong>.</p>
            <p><em>"Your OTP for verification is: ${otp}".It is valid for 10 minutes.</em></p>
            <a href="[Your CTA URL]" class="cta-button">View Details</a>
        </div>
        <div class="footer">
            <p>If you have any questions, contact us at <a href="mailto:support@yourapp.com">support@dostana.com</a></p>
            <p>&copy; 2025 Dostana. All rights reserved.</p>
        </div>
    </div>
</body>
</html>

    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { isError: false };
  } catch (err) {
    console.error("Error sending email:", err);
    return { isError: true, err };
  }
};

// Function to generate and send OTP
const sendOtp = async (email) => {
  const otp = Math.floor(100000 + Math.random() * 900000); // Generate 6-digit OTP
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // Set expiry to 10 minutes from now
  console.log(expiresAt);
  // Check last OTP request
  await EmailVerification.findOne({ email });
  // if (emailAccount?.lastOtpRequestedAt) {
  //   const diff = now.getTime() - emailAccount.lastOtpRequestedAt.getTime();
  //   if (diff < 2 * 60 * 1000) {
  //     // Minimum 2-minute gap between requests
  //     return { isError: true, err: "Please wait for minutes for resend otp" };
  //   }
  // }

  // Send OTP via email
  const response = await sendOtpToEmail({ email, otp });
  if (response.isError) {
    return { isError: true, err: response.err };
  }

  // Save or update OTP details in the database
  await EmailVerification.findOneAndUpdate(
    { email },
    {
      email,
      otp,
      expiresAt,
      lastOtpRequestedAt: now,
    },
    { upsert: true, new: true }
  );

  return { isError: false };
};

// Function to validate OTP
const validateOtp = async (email, otp, verificationDetails) => {
  let errorDetails = { errMsg: "", successMsg: "" };

  if (verificationDetails.otp !== String(otp)) {
    errorDetails = {
      isError: true,
      errMsg: "Incorect OTP",
    };
  } else {
    errorDetails = {
      isError: false,
      successMsg: "OTP verified successfully",
    };
  }
  return errorDetails;
};

module.exports = { validateOtp, sendOtp };
