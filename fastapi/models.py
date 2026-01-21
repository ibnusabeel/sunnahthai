from pydantic import BaseModel
from typing import Optional

class LocalizedText(BaseModel):
    ar: Optional[str] = None
    th: Optional[str] = None

class HadithModel(BaseModel):
    hadith_id: str
    hadith_book: Optional[str] = None  # e.g., "bukhari", "muslim"
    hadith_no: Optional[str] = None
    kitab: LocalizedText
    bab: LocalizedText
    content: LocalizedText
    hadith_title: Optional[str] = None
    hadith_status: Optional[str] = None  # e.g., "เศาะฮีหฺ"
    status: str  # translation status

class HadithUpdateModel(BaseModel):
    kitab: Optional[LocalizedText] = None
    bab: Optional[LocalizedText] = None
    content: Optional[LocalizedText] = None
    hadith_title: Optional[str] = None
    hadith_status: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
