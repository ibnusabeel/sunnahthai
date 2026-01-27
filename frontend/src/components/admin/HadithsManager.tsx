
import React, { useState, useEffect } from 'react';
import {
    getHadiths, getAdminBooks, getKitabs,
    createAdminHadith, updateHadith, deleteAdminHadith
} from '../../lib/api';
import type { HadithItem, AdminBook, KitabItem } from '../../lib/api';

export default function HadithsManager() {
    // Data State
    const [hadiths, setHadiths] = useState<HadithItem[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filter State
    const [filterBook, setFilterBook] = useState('');
    const [filterKitab, setFilterKitab] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [search, setSearch] = useState('');

    // Metadata State (for options)
    const [books, setBooks] = useState<AdminBook[]>([]);
    const [kitabs, setKitabs] = useState<KitabItem[]>([]);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingHadith, setEditingHadith] = useState<HadithItem | null>(null);
    const [formData, setFormData] = useState({
        hadith_book: '',
        hadith_no: '',
        kitab_id: '', // for selection
        content_ar: '',
        content_th: '',
        status: 'pending',
        // Extra Fields
        bab_ar: '', bab_th: '',
        title_ar: '', title_th: '',
        chain_ar: '', chain_th: '',
        footnote_ar: '', footnote_th: '',
        grade_ar: '', grade_th: '',
        hadith_status: ''
    });

    const [activeTab, setActiveTab] = useState<'content' | 'metadata' | 'extras'>('content');

    // Load Books on Mount
    useEffect(() => {
        loadBooks();
    }, []);

    // Load Kitabs when Book changes (for filter)
    useEffect(() => {
        if (filterBook) {
            loadKitabs(filterBook, true); // true = for filter
        } else {
            setKitabs([]);
            setFilterKitab('');
        }
    }, [filterBook]);

    // Load Hadiths when filters change
    useEffect(() => {
        loadData();
    }, [page, filterBook, filterKitab, filterStatus]); // Search triggers separate or debounce? Let's trigger on enter or blur for search usually, but for simplicity let's rely on effect if we debounce. For now, we'll add a search button or trigger on effect if lazy.

    // Debounce search
    useEffect(() => {
        const timeout = setTimeout(() => {
            loadData();
        }, 800);
        return () => clearTimeout(timeout);
    }, [search]);


    async function loadBooks() {
        try {
            const data = await getAdminBooks();
            setBooks(data);
        } catch (e) { console.error(e); }
    }

    async function loadKitabs(book: string, forFilter = false) {
        try {
            const res = await getKitabs(book);
            if (forFilter) {
                setKitabs(res.kitabs);
            }
            return res.kitabs;
        } catch (e) { console.error(e); return []; }
    }

    async function loadData() {
        setLoading(true);
        try {
            // Mapping filterKitab (which might be ID or name?)
            // The API uses name match for kitab usually?
            // "kitab" param in getHadiths takes string.
            // If we select a kitab from dropdown, we typically get its Name to pass to API 
            // OR if API supported ID.
            // Current API supports name match. So we pass name.

            // Wait, KitabItem has th/ar/en. Which one to pass?
            // API `hadiths.ts` does `$or` on all. So passing Thai name is fine.
            let kitabName = '';
            if (filterKitab) {
                const k = kitabs.find(k => (k.kitab_id === filterKitab) || (String(k.id) === filterKitab));
                if (k) kitabName = k.name?.th || k.th || '';
            }

            const res = await getHadiths({
                book: filterBook,
                page,
                limit: 20,
                search,
                status: filterStatus,
                kitab: kitabName // Pass name
            });
            setHadiths(res.data);
            setTotal(res.total);
            setTotalPages(res.total_pages);
        } catch (err: any) {
            setError('Failed to load hadiths');
        } finally {
            setLoading(false);
        }
    }

    async function handleOpenModal(hadith?: HadithItem) {
        setError(null);
        if (hadith) {
            setEditingHadith(hadith);

            // If we are editing, we need kitabs for this hadith's book
            // But main list kitabs might be for filterBook.
            // If they differ, we need to fetch.
            // For simplicity, we only allow editing if book matches or we simple fetch again?
            // Let's just fetch kitabs for the hadith's book if different.

            setFormData({
                hadith_book: hadith.hadith_book,
                hadith_no: hadith.hadith_no || '',
                kitab_id: hadith.kitab?.id ? String(hadith.kitab.id) : '', // We use 'id' (order) mostly for linking currently? Or kitab_id? 
                // DB uses kitab: { id: 1, ... } usually from CSV.
                // admin API put expects kitab: { id: ... } for updates.
                content_ar: hadith.content.ar,
                content_th: hadith.content.th || '',
                status: hadith.status,
                // Maps fields
                bab_ar: hadith.bab?.ar || '', bab_th: hadith.bab?.th || '',
                title_ar: hadith.title?.ar || '', title_th: hadith.title?.th || '',
                chain_ar: hadith.chain?.ar || '', chain_th: hadith.chain?.th || '',
                footnote_ar: hadith.footnote?.ar || '', footnote_th: hadith.footnote?.th || '',
                grade_ar: hadith.grade?.ar || '', grade_th: hadith.grade?.th || '',
                hadith_status: hadith.hadith_status || ''
            });

            if (hadith.hadith_book !== filterBook) {
                // Fetch kitabs for this book context
                // This might update the dropdown "kitabs" state which affects filter dropdown too?
                // That's bad UX. We should separate filterKitabs and modalKitabs?
                // Or just load modalKitabs separately.
                // Ideally we separate them.
            }
        } else {
            setEditingHadith(null);
            setFormData({
                hadith_book: filterBook || (books[0]?.book || ''),
                hadith_no: '',
                kitab_id: '',
                content_ar: '',
                content_th: '',
                status: 'pending',
                bab_ar: '', bab_th: '',
                title_ar: '', title_th: '',
                chain_ar: '', chain_th: '',
                footnote_ar: '', footnote_th: '',
                grade_ar: '', grade_th: '',
                hadith_status: ''
            });
        }
        setIsModalOpen(true);
    }

    // Helper for modal kitabs
    const [modalKitabs, setModalKitabs] = useState<KitabItem[]>([]);
    useEffect(() => {
        if (isModalOpen && formData.hadith_book) {
            getKitabs(formData.hadith_book).then(res => setModalKitabs(res.kitabs));
        }
    }, [isModalOpen, formData.hadith_book]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        try {
            // Find selected kitab name/id from modalKitabs
            const selectedK = modalKitabs.find(k => String(k.id) === formData.kitab_id || k.kitab_id === formData.kitab_id);

            const payload: any = {
                hadith_book: formData.hadith_book,
                hadith_no: formData.hadith_no,
                content: {
                    ar: formData.content_ar,
                    th: formData.content_th
                },
                status: formData.status,
                kitab: selectedK ? {
                    id: selectedK.id, // numeric id
                    th: selectedK.name?.th || selectedK.th,
                    ar: selectedK.name?.ar || selectedK.ar,
                } : {},
                // Extra Fields
                bab: { ar: formData.bab_ar, th: formData.bab_th },
                title: { ar: formData.title_ar, th: formData.title_th },
                chain: { ar: formData.chain_ar, th: formData.chain_th },
                footnote: { ar: formData.footnote_ar, th: formData.footnote_th },
                grade: { ar: formData.grade_ar, th: formData.grade_th },
                hadith_status: formData.hadith_status
            };

            if (editingHadith) {
                await updateHadith(editingHadith.hadith_id, payload);
            } else {
                await createAdminHadith(payload);
            }
            setIsModalOpen(false);
            loadData();
        } catch (err: any) {
            alert(err.message);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Delete this hadith?')) return;
        try {
            await deleteAdminHadith(id);
            loadData();
        } catch (err: any) {
            alert(err.message);
        }
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-600">
                จัดการหะดีษ
            </h2>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
                <select
                    value={filterBook}
                    onChange={e => { setFilterBook(e.target.value); setPage(1); }}
                    className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                >
                    <option value="">ทุกเล่ม</option>
                    {books.map(b => <option key={b.book} value={b.book}>{b.th}</option>)}
                </select>

                <select
                    value={filterKitab}
                    onChange={e => { setFilterKitab(e.target.value); setPage(1); }}
                    disabled={!filterBook}
                    className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 max-w-[200px]"
                >
                    <option value="">ทุกบท</option>
                    {kitabs.map(k => <option key={k.kitab_id || k.id} value={k.kitab_id || k.id}>{k.name?.th || k.th}</option>)}
                </select>

                <select
                    value={filterStatus}
                    onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
                    className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                >
                    <option value="">ทุกสถานะ</option>
                    <option value="translated">แปลแล้ว</option>
                    <option value="pending">รอการแปล</option>
                </select>

                <div className="relative flex-1 min-w-[200px]">
                    <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
                    <input
                        type="text"
                        placeholder="ค้นหา (ID, เนื้อหา)..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    />
                </div>

                <button
                    onClick={() => handleOpenModal()}
                    className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg text-sm shadow-sm transition-all"
                >
                    + เพิ่ม
                </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {loading ? <div className="p-10 text-center text-gray-400">Loading...</div> : (
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                            <tr>
                                <th className="px-6 py-4 w-24">ID</th>
                                <th className="px-6 py-4 w-1/3">เนื้อหา (TH)</th>
                                <th className="px-6 py-4 w-1/3">เนื้อหา (AR)</th>
                                <th className="px-6 py-4 lg:w-32 text-center">สถานะ</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {hadiths.map(h => (
                                <tr key={h.hadith_id} className="hover:bg-gray-50/50">
                                    <td className="px-6 py-4 text-xs font-mono text-gray-500">
                                        <div>{h.hadith_book}</div>
                                        <div className="font-bold text-gray-800">#{h.hadith_no}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="line-clamp-2 text-sm text-gray-800">{h.content.th || '-'}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="line-clamp-2 text-lg font-arabic text-gray-600" dir="rtl">{h.content.ar}</div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${h.status === 'translated' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                                            }`}>
                                            {h.status === 'translated' ? 'แปลแล้ว' : 'รอแปล'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => handleOpenModal(h)} className="text-blue-600 hover:underline text-sm">Edit</button>
                                            <button onClick={() => handleDelete(h.hadith_id)} className="text-red-500 hover:underline text-sm">Delete</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                {!loading && hadiths.length === 0 && <div className="p-10 text-center text-gray-400">ไม่พบข้อมูล</div>}

                {/* Pagination */}
                <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                        แสดง {hadiths.length} รายการ (จากทั้งหมด {total})
                    </span>
                    <div className="flex gap-2">
                        <button
                            disabled={page <= 1}
                            onClick={() => setPage(p => p - 1)}
                            className="px-3 py-1 bg-white border border-gray-300 rounded text-sm disabled:opacity-50"
                        >
                            &lt;
                        </button>
                        <span className="px-3 py-1 text-sm text-gray-600">
                            หน้า {page} / {totalPages}
                        </span>
                        <button
                            disabled={page >= totalPages}
                            onClick={() => setPage(p => p + 1)}
                            className="px-3 py-1 bg-white border border-gray-300 rounded text-sm disabled:opacity-50"
                        >
                            &gt;
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-lg text-gray-800">
                                {editingHadith ? `แก้ไขหะดีษ ${editingHadith.hadith_id}` : 'เพิ่มหะดีษใหม่'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>

                        {/* Tabs Header */}
                        <div className="flex border-b border-gray-100 bg-gray-50/50">
                            <button
                                type="button"
                                onClick={() => setActiveTab('content')}
                                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'content' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                            >
                                Content & Info
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('metadata')}
                                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'metadata' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                            >
                                Chapters & Titles
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('extras')}
                                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'extras' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                            >
                                Metadata (Chain, Grade)
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
                            {/* TAB: CONTENT */}
                            {activeTab === 'content' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Book</label>
                                            <select
                                                className="w-full border rounded p-2"
                                                value={formData.hadith_book}
                                                onChange={e => setFormData({ ...formData, hadith_book: e.target.value })}
                                                disabled={!!editingHadith}
                                            >
                                                <option value="">Select Book</option>
                                                {books.map(b => <option key={b.book} value={b.book}>{b.th}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Hadith No</label>
                                            <input
                                                type="number"
                                                className="w-full border rounded p-2"
                                                value={formData.hadith_no}
                                                onChange={e => setFormData({ ...formData, hadith_no: e.target.value })}
                                                disabled={!!editingHadith}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-1">Status</label>
                                        <div className="flex gap-4">
                                            <select
                                                className="w-full border rounded p-2"
                                                value={formData.status}
                                                onChange={e => setFormData({ ...formData, status: e.target.value })}
                                            >
                                                <option value="pending">Pending (รอแปล)</option>
                                                <option value="translated">Translated (แปลแล้ว)</option>
                                            </select>

                                            <input
                                                type="text"
                                                placeholder="Grade (e.g. Hasan, Sahih)"
                                                className="w-full border rounded p-2"
                                                value={formData.hadith_status}
                                                onChange={e => setFormData({ ...formData, hadith_status: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-1">Arabic Content</label>
                                        <textarea
                                            className="w-full border rounded p-2 h-32 font-arabic text-lg"
                                            dir="rtl"
                                            value={formData.content_ar}
                                            onChange={e => setFormData({ ...formData, content_ar: e.target.value })}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-1">Thai Translation</label>
                                        <textarea
                                            className="w-full border rounded p-2 h-32"
                                            value={formData.content_th}
                                            onChange={e => setFormData({ ...formData, content_th: e.target.value })}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-1">Footnote (Thai)</label>
                                        <textarea
                                            className="w-full border rounded p-2 h-20 text-sm"
                                            value={formData.footnote_th}
                                            onChange={e => setFormData({ ...formData, footnote_th: e.target.value })}
                                            placeholder="เชิงอรรถ..."
                                        />
                                    </div>
                                </div>
                            )}

                            {/* TAB: METADATA (Chapters) */}
                            {activeTab === 'metadata' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Kitab (Chapter)</label>
                                        <select
                                            className="w-full border rounded p-2"
                                            value={formData.kitab_id}
                                            onChange={e => setFormData({ ...formData, kitab_id: e.target.value })}
                                        >
                                            <option value="">Select Kitab</option>
                                            {modalKitabs.map(k => (
                                                <option key={k.id || k.kitab_id} value={k.id || k.kitab_id}>
                                                    {k.id}. {k.name?.th || k.th}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Bab (Door) - Arabic</label>
                                            <input
                                                type="text"
                                                className="w-full border rounded p-2 font-arabic"
                                                dir="rtl"
                                                value={formData.bab_ar}
                                                onChange={e => setFormData({ ...formData, bab_ar: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Bab (Door) - Thai</label>
                                            <input
                                                type="text"
                                                className="w-full border rounded p-2"
                                                value={formData.bab_th}
                                                onChange={e => setFormData({ ...formData, bab_th: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Custom Title - Arabic</label>
                                            <input
                                                type="text"
                                                className="w-full border rounded p-2 font-arabic"
                                                dir="rtl"
                                                value={formData.title_ar}
                                                onChange={e => setFormData({ ...formData, title_ar: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Custom Title - Thai</label>
                                            <input
                                                type="text"
                                                className="w-full border rounded p-2"
                                                value={formData.title_th}
                                                onChange={e => setFormData({ ...formData, title_th: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB: EXTRAS */}
                            {activeTab === 'extras' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Chain (Sanad) - Arabic</label>
                                            <textarea
                                                className="w-full border rounded p-2 h-24 font-arabic"
                                                dir="rtl"
                                                value={formData.chain_ar}
                                                onChange={e => setFormData({ ...formData, chain_ar: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Chain (Sanad) - Thai</label>
                                            <textarea
                                                className="w-full border rounded p-2 h-24"
                                                value={formData.chain_th}
                                                onChange={e => setFormData({ ...formData, chain_th: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Grade Text - Arabic</label>
                                            <input
                                                type="text"
                                                className="w-full border rounded p-2 font-arabic"
                                                dir="rtl"
                                                value={formData.grade_ar}
                                                onChange={e => setFormData({ ...formData, grade_ar: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Grade Text - Thai</label>
                                            <input
                                                type="text"
                                                className="w-full border rounded p-2"
                                                value={formData.grade_th}
                                                onChange={e => setFormData({ ...formData, grade_th: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Footnote - Arabic</label>
                                            <textarea
                                                className="w-full border rounded p-2 h-20 font-arabic"
                                                dir="rtl"
                                                value={formData.footnote_ar}
                                                onChange={e => setFormData({ ...formData, footnote_ar: e.target.value })}
                                            />
                                        </div>
                                        {/* Footnote Thai is in main tab */}
                                    </div>
                                </div>
                            )}
                        </form>

                        <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded text-gray-600 hover:bg-gray-200">Cancel</button>
                            <button onClick={handleSubmit} className="px-4 py-2 rounded bg-primary text-white hover:bg-primary-dark">Save</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
