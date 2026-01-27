/**
 * API Service Layer
 * Connects to FastAPI backend for Hadith data
 */

// API base URL configuration
// Points to the separate Fastify backend server
// Points to the separate Fastify backend server
export const API_BASE_URL = import.meta.env.PUBLIC_API_URL || 'http://localhost:3000';

export interface HadithItem {
    hadith_id: string;
    hadith_book: string;
    hadith_no?: string;
    kitab: { id?: number; ar: string; th?: string; en?: string };
    bab?: { ar?: string; th?: string; en?: string };
    title?: { ar?: string; th?: string };
    chain?: { ar?: string; th?: string };
    content: { ar: string; th?: string };
    footnote?: { ar?: string; th?: string };
    grade?: { ar?: string; th?: string };
    grader?: {
        shortName?: { ar?: string };
        fullName?: { ar?: string };
    };
    grade_grades?: string;
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
    // Normalized stats
    id?: number;
    hadith_count?: number;
    // DB structure uses name object
    name?: {
        ar?: string;
        th?: string;
        en?: string;
    };
    // Legacy support or flattened support?
    // Let's stick to name object as primary
    ar?: string;
    th?: string;
    en?: string;
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
    adab: { th: 'อัล-อะดับ อัล-มุฟร็อด', ar: 'الأدب المفرد', icon: '📓' },
    lulu: { th: 'อัล-ลุ\'ลุ\' วัล-มัรญาน', ar: 'اللؤلؤ والمرجان', icon: '💎' },
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

export async function updateBookInfo(book: string, data: Partial<BookInfo> & { th?: string; ar?: string }): Promise<BookInfo> {
    const res = await fetch(`${API_BASE_URL}/api/book-info/${book}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update book info');
    return res.json();
}

export async function getDynamicBookNames(): Promise<Record<string, { th: string; ar: string; icon: string }>> {
    try {
        const res = await fetch(`${API_BASE_URL}/api/book-names`);
        if (!res.ok) return BOOK_NAMES;

        const dynamicNames = await res.json();
        const merged = { ...BOOK_NAMES };

        for (const [key, val] of Object.entries(dynamicNames) as [string, any][]) {
            if (merged[key]) {
                merged[key] = {
                    ...merged[key],
                    th: val.th || merged[key].th,
                    ar: val.ar || merged[key].ar,
                    icon: val.icon || merged[key].icon // Also map icon if available
                };
            } else {
                // Add new book if not in default list
                merged[key] = {
                    th: val.th || key,
                    ar: val.ar || '',
                    icon: val.icon || '📖'
                };
            }
        }
        return merged;
    } catch (e) {
        console.error("Failed to fetch dynamic book names:", e);
        return BOOK_NAMES;
    }
}

// Kitab Management
export async function createKitab(data: KitabItem & { book: string; order?: number }): Promise<KitabItem> {
    const res = await fetch(`${API_BASE_URL}/api/kitabs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create kitab');
    return res.json();
}

export async function updateKitab(kitab_id: string, data: Partial<KitabItem> & { name?: any, order?: number }): Promise<KitabItem> {
    const res = await fetch(`${API_BASE_URL}/api/kitab/${kitab_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update kitab');
    return res.json();
}

export async function deleteKitab(kitab_id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/kitab/${kitab_id}`, {
        method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete kitab');
}

// Hadith Management
export async function updateHadith(hadith_id: string, data: Partial<HadithItem>): Promise<HadithItem> {
    const res = await fetch(`${API_BASE_URL}/api/hadith/${hadith_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update hadith');
    // ... (existing updateHadith)
    return res.json();
}

// ------------------------------------------
// Articles & Categories System
// ------------------------------------------

// Types
export interface CategoryItem {
    _id?: string;
    name: string;
    slug: string;
    description?: string;
    created_at?: string;
}

export interface ArticleItem {
    _id?: string;
    title: string;
    slug: string;
    category: string; // slug or ID
    content: string;
    cover_image?: string;
    status: 'draft' | 'published';
    author?: string;
    created_at?: string;
    updated_at?: string;
}

export interface ArticlesResponse {
    data: ArticleItem[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
}

// Upload
export async function uploadImage(file: File): Promise<{ url: string; filename: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE_URL}/api/upload`, {
        method: 'POST',
        body: formData
    });

    if (!res.ok) throw new Error('Failed to upload image');
    return res.json();
}

// Categories
export async function getCategories(): Promise<{ categories: CategoryItem[] }> {
    const res = await fetch(`${API_BASE_URL}/api/categories`);
    if (!res.ok) throw new Error('Failed to fetch categories');
    return res.json();
}

export async function createCategory(data: Partial<CategoryItem>): Promise<CategoryItem> {
    const res = await fetch(`${API_BASE_URL}/api/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create category');
    return res.json();
}

export async function updateCategory(id: string, data: Partial<CategoryItem>): Promise<CategoryItem> {
    const res = await fetch(`${API_BASE_URL}/api/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update category');
    return res.json();
}

export async function deleteCategory(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/categories/${id}`, {
        method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete category');
}

// Articles
export async function getArticles(params: { page?: number; limit?: number; status?: string; category?: string; search?: string } = {}): Promise<ArticlesResponse> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.status) searchParams.set('status', params.status);
    if (params.category) searchParams.set('category', params.category);
    if (params.search) searchParams.set('search', params.search);

    const res = await fetch(`${API_BASE_URL}/api/articles?${searchParams.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch articles');
    return res.json();
}

export async function getArticle(idOrSlug: string): Promise<ArticleItem> {
    const res = await fetch(`${API_BASE_URL}/api/articles/${idOrSlug}`);
    if (!res.ok) throw new Error('Article not found');
    return res.json();
}

export async function createArticle(data: Partial<ArticleItem>): Promise<ArticleItem> {
    const res = await fetch(`${API_BASE_URL}/api/articles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create article');
    return res.json();
}

export async function updateArticle(id: string, data: Partial<ArticleItem>): Promise<ArticleItem> {
    const res = await fetch(`${API_BASE_URL}/api/articles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update article');
    return res.json();
}

export async function deleteArticle(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/articles/${id}`, {
        method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete article');
}

// ------------------------------------------
// ADMIN API
// ------------------------------------------

export interface AdminBook extends BookItem {
    th: string;
    ar?: string;
    description?: string;
    icon?: string;
    color?: string;
}

export async function getAdminBooks(): Promise<AdminBook[]> {
    const res = await fetch(`${API_BASE_URL}/api/admin/books`);
    if (!res.ok) throw new Error('Failed to fetch admin books');
    const json = await res.json();
    return json.data;
}

export async function createAdminBook(data: any): Promise<AdminBook> {
    const res = await fetch(`${API_BASE_URL}/api/admin/books`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create book');
    const json = await res.json();
    return json.data;
}

export async function updateAdminBook(book: string, data: any): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/admin/books/${book}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update book');
}

export async function deleteAdminBook(book: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/admin/books/${book}`, {
        method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete book');
}

export async function createAdminHadith(data: any): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/api/admin/hadiths`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to create hadith');
    }
    return res.json();
}

export async function deleteAdminHadith(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/admin/hadiths/${id}`, {
        method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete hadith');
}
