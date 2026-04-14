import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from src.config import Config

def send_smtp_notification(subject: str, html_content: str):
    sender_email = Config.GMAIL_USER
    receiver_email = Config.GMAIL_USER
    password = Config.GMAIL_APP_PASSWORD

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = f"Lumis Bug Bot <{sender_email}>"
    message["To"] = receiver_email

    part = MIMEText(html_content, "html")
    message.attach(part)

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(sender_email, password)
        server.sendmail(sender_email, receiver_email, message.as_string())