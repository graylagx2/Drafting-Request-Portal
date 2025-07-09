"""
Handles outbound email logic asynchronously using Python's threading,
for seamless, non-blocking email delivery.
"""

import threading
import smtplib
from email.message import EmailMessage
from flask import current_app
import logging

logger = logging.getLogger(__name__)


def send_email(subject, recipients, body, html=None, cc=None, attachments=None):
    """
    Sends an email asynchronously without blocking the main thread.

    Reads SMTP settings from Flask config:
      MAIL_SERVER, MAIL_PORT, MAIL_USE_TLS, MAIL_USERNAME,
      MAIL_PASSWORD, MAIL_DEFAULT_SENDER.

    Parameters:
      subject (str): Email subject.
      recipients (list): Recipient email addresses.
      body (str): Plain-text body.
      html (str): HTML body (optional).
      cc (list): CC addresses (optional).
      attachments (list): List of file paths to attach (optional).
    """
    app = current_app._get_current_object()

    smtp_server = app.config['MAIL_SERVER']
    smtp_port = app.config['MAIL_PORT']
    use_tls = app.config.get('MAIL_USE_TLS', False)
    username = app.config.get('MAIL_USERNAME')
    password = app.config.get('MAIL_PASSWORD')
    sender = app.config.get('MAIL_DEFAULT_SENDER') or username

    app.logger.info(
        f"Queueing email: subject={subject!r}, sender={sender!r}, "
        f"to={recipients}, cc={cc or []}, server={smtp_server}:{smtp_port}, TLS={use_tls}"
    )

    def _send():
        try:
            msg = EmailMessage()
            msg['Subject'] = subject
            msg['From'] = sender
            msg['To'] = ', '.join(recipients)
            if cc:
                msg['Cc'] = ', '.join(cc)

            # Set plain-text and optional HTML parts
            msg.set_content(body or '')
            if html:
                msg.add_alternative(html, subtype='html')

            # Attach files if provided
            if attachments:
                for path in attachments:
                    try:
                        with open(path, 'rb') as f:
                            data = f.read()
                        filename = path.replace('\\', '/').split('/')[-1]
                        msg.add_attachment(
                            data,
                            maintype='application',
                            subtype='octet-stream',
                            filename=filename
                        )
                    except Exception as exc:
                        app.logger.error(
                            f"Attachment error ({path}): {exc}", exc_info=True)

            # Send via SMTP
            with smtplib.SMTP(smtp_server, smtp_port) as server:
                server.ehlo()
                if use_tls:
                    server.starttls()
                    server.ehlo()
                if username and password:
                    server.login(username, password)
                server.send_message(msg)

            app.logger.info(
                f"Email sent successfully: subject={subject!r}, to={recipients}")
        except Exception as exc:
            app.logger.error(f"Failed to send email: {exc}", exc_info=True)

    thread = threading.Thread(target=_send, daemon=True)
    thread.start()
