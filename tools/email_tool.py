"""
Email tool for accessing and sending emails.
"""
import os
from typing import Dict, List, Any, Optional
import json

# Try to import email libraries
try:
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    EMAIL_AVAILABLE = True
except ImportError:
    EMAIL_AVAILABLE = False

# Try to import Gmail API
try:
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import Flow
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
    GMAIL_AVAILABLE = True
except ImportError:
    GMAIL_AVAILABLE = False


class EmailTool:
    """Tool for accessing and sending emails."""
    
    def __init__(self):
        """Initialize email tool."""
        self.gmail_service = None
        self._authenticate()
    
    def _authenticate(self):
        """Authenticate with Gmail API if available."""
        if not GMAIL_AVAILABLE:
            return
        
        token = os.getenv('GMAIL_API_TOKEN')
        if token:
            try:
                creds = Credentials.from_authorized_user_info(json.loads(token))
                self.gmail_service = build('gmail', 'v1', credentials=creds)
            except Exception as e:
                print(f"Warning: Gmail authentication failed: {e}")
    
    def get_recent_emails(self, max_results: int = 10, query: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get recent emails.
        
        Args:
            max_results: Maximum number of emails to return
            query: Gmail search query (e.g., "from:example@gmail.com")
        
        Returns:
            List of email dictionaries
        """
        if not self.gmail_service:
            return []
        
        try:
            results = self.gmail_service.users().messages().list(
                userId='me',
                maxResults=max_results,
                q=query or ''
            ).execute()
            
            messages = results.get('messages', [])
            emails = []
            
            for msg in messages:
                message = self.gmail_service.users().messages().get(
                    userId='me',
                    id=msg['id'],
                    format='metadata',
                    metadataHeaders=['From', 'Subject', 'Date']
                ).execute()
                
                headers = {h['name']: h['value'] for h in message.get('payload', {}).get('headers', [])}
                
                emails.append({
                    'id': msg['id'],
                    'from': headers.get('From', ''),
                    'subject': headers.get('Subject', ''),
                    'date': headers.get('Date', ''),
                    'snippet': message.get('snippet', '')
                })
            
            return emails
        except HttpError as e:
            print(f"Error fetching emails: {e}")
            return []
        except Exception as e:
            print(f"Unexpected error in get_recent_emails: {e}")
            return []
    
    def send_email(self, to: str, subject: str, body: str, is_html: bool = False) -> Dict[str, Any]:
        """
        Send an email.
        
        Args:
            to: Recipient email address
            subject: Email subject
            body: Email body
            is_html: Whether body is HTML
        
        Returns:
            Result dictionary with success status
        """
        # Try Gmail API first
        if self.gmail_service:
            try:
                message = MIMEMultipart()
                message['to'] = to
                message['subject'] = subject
                
                if is_html:
                    message.attach(MIMEText(body, 'html'))
                else:
                    message.attach(MIMEText(body, 'plain'))
                
                raw_message = message.as_string().encode('utf-8')
                import base64
                encoded_message = base64.urlsafe_b64encode(raw_message).decode('utf-8')
                
                send_message = self.gmail_service.users().messages().send(
                    userId='me',
                    body={'raw': encoded_message}
                ).execute()
                
                return {
                    "success": True,
                    "message_id": send_message.get('id'),
                    "method": "gmail_api"
                }
            except Exception as e:
                print(f"Gmail API send failed: {e}")
        
        # Fallback to SMTP
        if EMAIL_AVAILABLE:
            try:
                smtp_server = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
                smtp_port = int(os.getenv('SMTP_PORT', '587'))
                smtp_user = os.getenv('SMTP_USER')
                smtp_password = os.getenv('SMTP_PASSWORD')
                
                if not smtp_user or not smtp_password:
                    return {
                        "success": False,
                        "error": "SMTP credentials not configured"
                    }
                
                msg = MIMEMultipart()
                msg['From'] = smtp_user
                msg['To'] = to
                msg['Subject'] = subject
                
                if is_html:
                    msg.attach(MIMEText(body, 'html'))
                else:
                    msg.attach(MIMEText(body, 'plain'))
                
                with smtplib.SMTP(smtp_server, smtp_port) as server:
                    server.starttls()
                    server.login(smtp_user, smtp_password)
                    server.send_message(msg)
                
                return {
                    "success": True,
                    "method": "smtp"
                }
            except Exception as e:
                return {
                    "success": False,
                    "error": str(e)
                }
        
        return {
            "success": False,
            "error": "No email service available"
        }
    
    def draft_email(self, to: str, subject: str, body: str) -> Dict[str, Any]:
        """
        Create a draft email (doesn't send).
        
        Args:
            to: Recipient email address
            subject: Email subject
            body: Email body
        
        Returns:
            Draft information
        """
        return {
            "draft": {
                "to": to,
                "subject": subject,
                "body": body
            },
            "note": "This is a draft. User can review before sending."
        }


def create_email_tool() -> List['Tool']:
    """Create Tool instances for email access."""
    from .tool_registry import Tool
    
    email = EmailTool()
    
    def get_recent_emails_handler(max_results: int = 10, query: Optional[str] = None) -> Dict[str, Any]:
        """Handler for get_recent_emails tool."""
        emails = email.get_recent_emails(max_results=max_results, query=query)
        return {
            "emails": emails,
            "count": len(emails)
        }
    
    def draft_email_handler(to: str, subject: str, body: str) -> Dict[str, Any]:
        """Handler for draft_email tool."""
        return email.draft_email(to, subject, body)
    
    tools = []
    
    tools.append(Tool(
        name="get_recent_emails",
        description="Get recent emails from user's inbox. Useful for understanding context, pending tasks, or important communications related to the session.",
        parameters={
            "properties": {
                "max_results": {
                    "type": "integer",
                    "description": "Maximum number of emails to return (default: 10)"
                },
                "query": {
                    "type": "string",
                    "description": "Gmail search query (optional, e.g., 'from:example@gmail.com' or 'subject:meeting')"
                }
            },
            "required": []
        },
        handler=get_recent_emails_handler
    ))
    
    tools.append(Tool(
        name="draft_email",
        description="Create a draft email. Use this when user's session activity suggests they need to send an email. Always create a draft first for user review before sending.",
        parameters={
            "properties": {
                "to": {
                    "type": "string",
                    "description": "Recipient email address"
                },
                "subject": {
                    "type": "string",
                    "description": "Email subject line"
                },
                "body": {
                    "type": "string",
                    "description": "Email body content"
                }
            },
            "required": ["to", "subject", "body"]
        },
        handler=draft_email_handler
    ))
    
    return tools
