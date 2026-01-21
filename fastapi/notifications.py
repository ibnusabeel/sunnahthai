"""
Notification Service for Error Alerts
- LINE OA: @436qprra
- Telegram: @SunnahTHBot
"""

import os
import requests
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Telegram Config
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "8596637260:AAFkjpHpIkUs29BAwQQq5-3yQa-jFZTYRhA")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")  # จะต้องหา Chat ID

# LINE Config
LINE_CHANNEL_TOKEN = os.getenv("LINE_CHANNEL_TOKEN", "")
LINE_USER_ID = os.getenv("LINE_USER_ID", "")  # User ID ของ Admin


def send_telegram_message(message: str) -> bool:
    """ส่งข้อความแจ้งเตือนผ่าน Telegram"""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        print("⚠️ Telegram not configured")
        return False
    
    try:
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        payload = {
            "chat_id": TELEGRAM_CHAT_ID,
            "text": message,
            "parse_mode": "HTML"
        }
        response = requests.post(url, json=payload, timeout=10)
        return response.status_code == 200
    except Exception as e:
        print(f"❌ Telegram Error: {e}")
        return False


def send_line_message(message: str) -> bool:
    """ส่งข้อความแจ้งเตือนผ่าน LINE OA"""
    if not LINE_CHANNEL_TOKEN or not LINE_USER_ID:
        print("⚠️ LINE not configured")
        return False
    
    try:
        url = "https://api.line.me/v2/bot/message/push"
        headers = {
            "Authorization": f"Bearer {LINE_CHANNEL_TOKEN}",
            "Content-Type": "application/json"
        }
        payload = {
            "to": LINE_USER_ID,
            "messages": [{"type": "text", "text": message}]
        }
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        return response.status_code == 200
    except Exception as e:
        print(f"❌ LINE Error: {e}")
        return False


def notify_error(error_type: str, error_message: str, details: str = ""):
    """ส่งแจ้งเตือน Error ไปทุกช่องทาง"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    message = f"""🚨 <b>Error Alert</b>
    
📅 Time: {timestamp}
❌ Type: {error_type}
📝 Message: {error_message}
{f'📋 Details: {details}' if details else ''}

🌐 Server: sunnahthai.com
"""
    
    # ส่งไปทุกช่องทาง
    telegram_sent = send_telegram_message(message)
    line_sent = send_line_message(message.replace("<b>", "").replace("</b>", ""))
    
    return {"telegram": telegram_sent, "line": line_sent}


def notify_admin(title: str, message: str):
    """ส่งข้อความทั่วไปถึง Admin"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    full_message = f"""📢 <b>{title}</b>

📅 {timestamp}
{message}
"""
    
    send_telegram_message(full_message)
    send_line_message(full_message.replace("<b>", "").replace("</b>", ""))


# ===== ฟังก์ชันหา Telegram Chat ID =====
def get_telegram_updates():
    """
    ใช้สำหรับหา Chat ID
    วิธีใช้: 
    1. พิมพ์ /start ใน Bot @SunnahTHBot
    2. รัน python -c "from notifications import get_telegram_updates; get_telegram_updates()"
    """
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getUpdates"
    response = requests.get(url)
    data = response.json()
    
    print("📨 Recent messages:")
    for update in data.get("result", []):
        chat = update.get("message", {}).get("chat", {})
        print(f"  Chat ID: {chat.get('id')}")
        print(f"  Username: {chat.get('username')}")
        print(f"  Name: {chat.get('first_name')}")
        print("---")
    
    return data


if __name__ == "__main__":
    # ทดสอบ
    print("🔍 Getting Telegram updates to find Chat ID...")
    get_telegram_updates()
