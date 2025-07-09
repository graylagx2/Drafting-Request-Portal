#!/usr/bin/env python3
"""
Standalone script to test SMTP email delivery with hard‑coded credentials.

Usage:
    python scripts/test_email.py

All values are hard‑coded for immediate testing.
"""

import smtplib
from email.message import EmailMessage

# SMTP server configuration (hard‑coded)
SMTP_SERVER = 'smtp.gmail.com'
SMTP_PORT = 587
USERNAME = 'grantgetzfrid@gmail.com'
# Your Gmail password or App Password
PASSWORD = 'kssc sqte tqua pugh'
SENDER = 'grantgetzfrid@gmail.com'
RECIPIENT = 'ggetzfrid@kernenergy.com'


def main():
    # Compose the message
    msg = EmailMessage()
    msg['Subject'] = 'Kern‑Energy‑Nexus Hard‑Coded Test Email'
    msg['From'] = SENDER
    msg['To'] = RECIPIENT
    msg.set_content('This is a hard‑coded test email from your test script.')

    try:
        # Connect to SMTP server with TLS
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.set_debuglevel(1)     # Show full SMTP dialog
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(USERNAME, PASSWORD)
            server.send_message(msg)
        print(f"SUCCESS: Email sent to {RECIPIENT}")
    except Exception as e:
        print(f"ERROR: Failed to send email: {e}")


if __name__ == '__main__':
    main()
