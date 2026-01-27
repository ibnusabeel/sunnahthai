
import React, { useState, useEffect } from 'react';
import {
    getKitabs, createKitab, updateKitab, deleteKitab,
    getAdminBooks
} from '../../lib/api';
import type { KitabItem, AdminBook } from '../../lib/api';

export default function KitabsManager() {
    const [books, setBooks] = useState<AdminBook[]>([]);
    const [selectedBook, setSelectedBook] = useState<string>('');
    const [kitabs, setKitabs] = useState<KitabItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Modal & Editing
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingKitab, setEditingKitab] = useState<KitabItem | null>(null);
    const [formData, setFormData] = useState({
        kitab_id: '',
        book: '',
        order: 0,
        name: { th: '', ar: '', en: '' }
    });

    useEffect(() => {
        loadBooks();
    }, []);

    useEffect(() => {
        if (selectedBook) {
            loadKitabs(selectedBook);
            // Auto set book in form
            setFormData(prev => ({ ...prev, book: selectedBook }));
        } else {
            setKitabs([]);
        }
    }, [selectedBook]);

    async function loadBooks() {
        try {
            const data = await getAdminBooks();
            setBooks(data);
            if (data.length > 0) setSelectedBook(data[0].book);
        } catch (err) {
            console.error(err);
        }
    }

    async function loadKitabs(book: string) {
        setLoading(true);
        try {
            const res = await getKitabs(book);
            setKitabs(res.kitabs || []);
        } catch (err) {
            console.error(err);
            setError('Failed to load kitabs');
        } finally {
            setLoading(false);
        }
    }

    function handleOpenModal(kitab?: KitabItem) {
        setError(null);
        if (kitab) {
            setEditingKitab(kitab);
            setFormData({
                kitab_id: kitab.kitab_id || '',
                book: selectedBook,
                order: kitab.id || 0,
                name: {
                    th: kitab.th || '',
                    ar: kitab.ar || '',
                    en: kitab.en || ''
                }
            });
        } else {
            setEditingKitab(null);
            // Find max order
            const maxOrder = kitabs.length > 0 ? Math.max(...kitabs.map(k => k.id || 0)) : 0;
            setFormData({
                kitab_id: crypto.randomUUID(), // auto-gen ID for new
                book: selectedBook,
                order: maxOrder + 1,
                name: { th: '', ar: '', en: '' }
            });
        }
        setIsModalOpen(true);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        try {
            const payload = {
                kitab_id: formData.kitab_id,
                book: formData.book,
                order: Number(formData.order),
                name: formData.name
            };

            if (editingKitab) {
                // For update, we use kitab_id as the key in the API
                await updateKitab(formData.kitab_id, payload);
            } else {
                await createKitab(payload);
            }
            await loadKitabs(selectedBook);
            setIsModalOpen(false);
        } catch (err: any) {
            setError(err.message || 'Operation failed');
        }
    }

    async function handleDelete(id: string) {
        if (!window.confirm("Are you sure? This will delete the kitab but hadiths might remain orphaned.")) return;
        try {
            await deleteKitab(id);
            await loadKitabs(selectedBook);
        } catch (err: any) {
            alert(err.message);
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-600">
                    จัดการบท (Kitabs)
                </h2>

                <div className="flex items-center gap-3">
                    <select
                        value={selectedBook}
                        onChange={(e) => setSelectedBook(e.target.value)}
                        className="px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 outline-none bg-white min-w-[200px]"
                    >
                        {books.map(b => (
                            <option key={b.book} value={b.book}>{b.th} ({b.book})</option>
                        ))}
                    </select>

                    <button
                        onClick={() => handleOpenModal()}
                        disabled={!selectedBook}
                        className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        + เพิ่มบทใหม่
                    </button>
                </div>
            </div>

            {error && <div className="p-4 bg-red-50 text-red-600 rounded-lg border border-red-200">{error}</div>}

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {loading ? (
                    <div className="p-10 text-center text-gray-500">Loading kitabs...</div>
                ) : kitabs.length === 0 ? (
                    <div className="p-10 text-center text-gray-400">ยังไม่มีข้อมูลบทในหนังสือเล่มนี้</div>
                ) : (
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                            <tr>
                                <th className="px-6 py-4 w-20 text-center">Order/ID</th>
                                <th className="px-6 py-4">ชื่อบท (TH)</th>
                                <th className="px-6 py-4">ชื่อบท (AR)</th>
                                <th className="px-6 py-4 text-center">หะดีษ</th>
                                <th className="px-6 py-4 text-right">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {kitabs.map((k) => (
                                <tr key={k.kitab_id || k.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4 text-center font-mono text-gray-500">{k.id}</td>
                                    <td className="px-6 py-4 font-medium text-gray-900">{k.name?.th || k.th || '-'}</td>
                                    <td className="px-6 py-4 font-arabic text-lg text-gray-600">{k.name?.ar || k.ar || '-'}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="bg-gray-100 px-2 py-1 rounded text-xs font-semibold text-gray-600">
                                            {k.hadith_count || 0}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => handleOpenModal(k)}
                                                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => k.kitab_id && handleDelete(k.kitab_id)}
                                                className="text-red-500 hover:text-red-700 text-sm font-medium ml-2"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="font-bold text-lg text-gray-800">
                                {editingKitab ? 'แก้ไขบท' : 'เพิ่มบทใหม่'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Order (ID)</label>
                                    <input
                                        type="number"
                                        required
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                        value={formData.order}
                                        onChange={e => setFormData({ ...formData, order: parseInt(e.target.value) })}
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">UUID (Auto)</label>
                                    <input
                                        type="text"
                                        disabled
                                        value={formData.kitab_id}
                                        className="w-full px-4 py-2 rounded-lg bg-gray-50 border border-gray-300 text-gray-500 text-xs"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อไทย</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                    value={formData.name.th}
                                    onChange={e => setFormData({ ...formData, name: { ...formData.name, th: e.target.value } })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่ออังกฤษ (Optional)</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                    value={formData.name.en}
                                    onChange={e => setFormData({ ...formData, name: { ...formData.name, en: e.target.value } })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่ออาหรับ</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-arabic"
                                    dir="rtl"
                                    value={formData.name.ar}
                                    onChange={e => setFormData({ ...formData, name: { ...formData.name, ar: e.target.value } })}
                                />
                            </div>

                            <div className="pt-4 flex gap-3 justify-end">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-5 py-2.5 rounded-lg text-gray-600 hover:bg-gray-100 font-medium transition-colors"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white font-medium shadow-lg shadow-primary/30 transition-all"
                                >
                                    บันทึก
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
