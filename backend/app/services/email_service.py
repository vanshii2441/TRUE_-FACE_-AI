"""
TRUE FACE AI — Gmail SMTP Email Sending Service

Handles sending One-Time Password (OTP) emails using Python's standard
smtplib and email.mime modules with STARTTLS security.
"""

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings

logger = logging.getLogger(__name__)


def _sanitize_log_message(msg: str) -> str:
    """Sanitize log output to prevent exposing SMTP credentials or secrets."""
    if not msg:
        return ""
    if settings.smtp_password and settings.smtp_password in msg:
        msg = msg.replace(settings.smtp_password, "******")
    if settings.secret_key and settings.secret_key in msg:
        msg = msg.replace(settings.secret_key, "******")
    return msg


def send_otp_email(to_email: str, otp_code: str) -> bool:
    """
    Send a 6-digit Email OTP to the specified recipient using SMTP STARTTLS.

    Args:
        to_email (str): Recipient email address.
        otp_code (str): 6-digit OTP code to send.

    Returns:
        bool: True if email was sent successfully.

    Raises:
        ValueError: If SMTP credentials or sender email are not configured.
        RuntimeError: If SMTP connection, authentication, or transmission fails.
    """
    sender = settings.emails_from_email or settings.smtp_user
    if not settings.smtp_user or not settings.smtp_password or not sender:
        logger.error("SMTP configuration missing in application settings.")
        raise ValueError(
            "SMTP credentials not configured. Please set SMTP_USER, SMTP_PASSWORD, and EMAILS_FROM_EMAIL in backend/.env"
        )

    expire_minutes = settings.otp_expire_minutes

    # Build MIME message with text and HTML alternatives
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Your {settings.app_name} Verification Code"
    msg["From"] = f"{settings.app_name} <{sender}>"
    msg["To"] = to_email

    # Plain text version
    text_content = (
        f"Hello,\n\n"
        f"Your verification code for {settings.app_name} is: {otp_code}\n\n"
        f"This code is valid for {expire_minutes} minutes.\n"
        f"If you did not request this code, please ignore this message.\n\n"
        f"Regards,\n"
        f"{settings.app_name} Team"
    )

    # HTML version
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f6f9; margin: 0; padding: 20px; }}
            .container {{ max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 10px; padding: 30px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }}
            .header {{ text-align: center; border-bottom: 1px solid #eef2f5; padding-bottom: 15px; margin-bottom: 20px; }}
            .header h2 {{ color: #1e293b; margin: 0; font-size: 22px; font-weight: 600; }}
            .otp-box {{ text-align: center; background: #f1f5f9; padding: 18px; border-radius: 8px; font-size: 30px; font-weight: 700; letter-spacing: 6px; color: #2563eb; margin: 24px 0; }}
            .notice {{ font-size: 14px; color: #475569; line-height: 1.5; }}
            .footer {{ font-size: 12px; color: #94a3b8; text-align: center; margin-top: 25px; border-top: 1px solid #eef2f5; padding-top: 15px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h2>{settings.app_name} Verification</h2>
            </div>
            <p class="notice">Hello,</p>
            <p class="notice">Your one-time verification code is below. Enter this code to complete your verification:</p>
            <div class="otp-box">{otp_code}</div>
            <p class="notice">This code is valid for <strong>{expire_minutes} minutes</strong>.</p>
            <p class="notice">If you did not request this code, please safely ignore this email.</p>
            <div class="footer">
                &copy; 2026 {settings.app_name}. All rights reserved.
            </div>
        </div>
    </body>
    </html>
    """

    msg.attach(MIMEText(text_content, "plain"))
    msg.attach(MIMEText(html_content, "html"))

    try:
        with smtplib.SMTP(
            settings.smtp_host, settings.smtp_port, timeout=15
        ) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(sender, [to_email], msg.as_string())

        logger.info("OTP email successfully sent to recipient.")
        return True

    except smtplib.SMTPAuthenticationError as e:
        err_msg = _sanitize_log_message(str(e))
        logger.error("SMTP Authentication Error [%s]: %s", type(e).__name__, err_msg)
        raise RuntimeError(f"SMTP authentication failed: {err_msg}") from e
    except smtplib.SMTPException as e:
        err_msg = _sanitize_log_message(str(e))
        logger.error("SMTP Transmission Error [%s]: %s", type(e).__name__, err_msg)
        raise RuntimeError(
            f"SMTP transmission failed [{type(e).__name__}]: {err_msg}"
        ) from e
    except Exception as e:
        err_msg = _sanitize_log_message(str(e))
        logger.error(
            "Unexpected Email Delivery Exception [%s]: %s", type(e).__name__, err_msg
        )
        raise RuntimeError(
            f"Failed to send OTP email [{type(e).__name__}]: {err_msg}"
        ) from e
