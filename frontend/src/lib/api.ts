/**
 * API Service Layer
 * Connects to FastAPI backend for Hadith data
 */

// API base URL configuration
// Points to the separate Fastify backend server
// Points to the separate Fastify backend server
const API_BASE_URL = import.meta.env.PUBLIC_API_URL || 'http://localhost:3000';

export interface HadithItem {
    hadith_id: string;
    hadith_book: string;
    hadith_no?: string;
    kitab: { ar: string; th?: string; en?: string };
    bab: { ar: string; th?: string; en?: string };
    content: { ar: string; th?: string };
    status: 'pending' | 'translated';
    last_updated?: string;
    hadith_status?: string; // New field for grade (Sahih, Hasan, etc.)
}

export interface StatsResponse {
    book: string | null;
    overall: {
        total: number;
        translated: number;
        pending: number;
        percentage: number;
    };
}

export interface HadithsResponse {
    book: string | null;
    data: HadithItem[];
    page: number;
    limit: number;
    total: number;
    total_pages: number;
}

export interface KitabItem {
    kitab_id?: string;
    ar: string;
    th: string;
    en?: string;
    id?: number;
    hadith_count?: number;
}

export interface KitabsResponse {
    book: string;
    kitabs: KitabItem[];
}

// Book item from /api/books
export interface BookItem {
    book: string;
    total: number;
    translated: number;
    pending: number;
    percentage: number;
}

export interface BooksResponse {
    books: BookItem[];
}

// Get all books from database
export async function getBooks(): Promise<BooksResponse> {
    const res = await fetch(`${API_BASE_URL}/api/books`);
    if (!res.ok) throw new Error('Failed to fetch books');
    return res.json();
}

// Get translation statistics
export async function getStats(book?: string): Promise<StatsResponse> {
    const url = book ? `${API_BASE_URL}/api/stats/${book}` : `${API_BASE_URL}/api/stats`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch stats');
    return res.json();
}

// Get list of hadiths with pagination and filters
export async function getHadiths(options: {
    book?: string;
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    kitab?: string;
} = {}): Promise<HadithsResponse> {
    const { book, page = 1, limit = 15, search = '', status = '', kitab = '' } = options;

    const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(search && { search }),
        ...(status && { status }),
        ...(kitab && { kitab }),
    });


    const url = book
        ? `${API_BASE_URL}/api/hadiths/${book}?${params}`
        : `${API_BASE_URL}/api/hadiths?${params}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch hadiths');
    return res.json();
}

// Get single hadith by ID
export async function getHadith(id: string): Promise<HadithItem> {
    const res = await fetch(`${API_BASE_URL}/api/hadith/${id}`);
    if (!res.ok) throw new Error('Hadith not found');
    return res.json();
}

// Get list of kitabs for a book
export async function getKitabs(book: string): Promise<KitabsResponse> {
    const res = await fetch(`${API_BASE_URL}/api/kitabs/${book}`);
    if (!res.ok) throw new Error('Failed to fetch kitabs');
    return res.json();
}

// Book name mappings (Thai)
export const BOOK_NAMES: Record<string, { th: string; ar: string; icon: string }> = {
    bukhari: { th: 'ซอเฮียะฮ์บุคอรี', ar: 'صحيح البخاري', icon: '📚' },
    muslim: { th: 'ซอเฮียะฮ์มุสลิม', ar: 'صحيح مسلم', icon: '📖' },
    nasai: { th: 'สุนันนะซาอี', ar: 'سنن النسائي', icon: '📕' },
    tirmidhi: { th: 'สุนันติรมิซี', ar: 'جامع الترمذي', icon: '📗' },
    abudawud: { th: 'สุนันอะบูดาวูด', ar: 'سنن أبي داود', icon: '📘' },
    ibnmajah: { th: 'สุนันอิบนุมาญะฮ์', ar: 'سنن ابن ماجه', icon: '📙' },
    malik: { th: 'มุวัตตอ อิหม่ามมาลิก', ar: 'موطأ الإمام مالك', icon: '📜' },
    darimi: { th: 'สุนันดาริมี', ar: 'سنن الدارمي', icon: '📚' },
    ahmad: { th: 'มุสนัด อะห์มัด', ar: 'مسند أحمد', icon: '📗' },
};

export interface BookInfo {
    book: string;
    description: string;
    created_at?: string;
    updated_at?: string;
}

export async function getBookInfo(book: string): Promise<BookInfo> {
    const res = await fetch(`${API_BASE_URL}/api/book-info/${book}`);
    if (!res.ok) throw new Error('Failed to fetch book info');
    return res.json();
}
