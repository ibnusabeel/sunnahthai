
import React, { useState, useEffect } from 'react';
import type { AdminBook } from '../../lib/api';
import { getAdminBooks, createAdminBook, updateAdminBook, deleteAdminBook } from '../../lib/api';

export default function BooksManager() {
    const [books, setBooks] = useState<AdminBook[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBook, setEditingBook] = useState<AdminBook | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        book: '',
        th: '',
        ar: '',
        description: '',
        icon: '📖',
        color: 'blue'
    });

    useEffect(() => {
        loadBooks();
    }, []);

    async function loadBooks() {
        try {
            setLoading(true);
            const data = await getAdminBooks();
            setBooks(data);
        } catch (err) {
            console.error(err);
            setError('Failed to load books');
        } finally {
            setLoading(false);
        }
    }

    function handleOpenModal(book?: AdminBook) {
        setError(null);
        if (book) {
            setEditingBook(book);
            setFormData({
                book: book.book,
                th: book.th,
                ar: book.ar || '',
                description: book.description || '',
                icon: book.icon || '📖',
                color: book.color || 'blue'
            });
        } else {
            setEditingBook(null);
            setFormData({
                book: '',
                th: '',
                ar: '',
                description: '',
                icon: '📖',
                color: 'blue'
            });
        }
        setIsModalOpen(true);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        try {
            if (editingBook) {
                await updateAdminBook(editingBook.book, formData);
            } else {
                await createAdminBook(formData);
            }
            await loadBooks();
            setIsModalOpen(false);
        } catch (err: any) {
            setError(err.message || 'Operation failed');
        }
    }

    async function handleDelete(book: string) {
        if (!window.confirm(`Are you sure you want to delete "${book}" metadata?`)) return;
        try {
            await deleteAdminBook(book);
            await loadBooks();
        } catch (err: any) {
            alert(err.message);
        }
    }

    if (loading) return <div className="text-center py-10">Loading books...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-600">
                    จัดการหนังสือ ({books.length})
                </h2>
                <button
                    onClick={() => handleOpenModal()}
                    className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg shadow-md transition-all flex items-center gap-2"
                >
                    <span>+</span> เพิ่มหนังสือใหม่
                </button>
            </div>

            {error && <div className="p-4 bg-red-50 text-red-600 rounded-lg border border-red-200">{error}</div>}

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                        <tr>
                            <th className="px-6 py-4">Book ID</th>
                            <th className="px-6 py-4">ชื่อหนังสือ (TH/AR)</th>
                            <th className="px-6 py-4">ความคืบหน้า</th>
                            <th className="px-6 py-4 text-center">หะดีษ</th>
                            <th className="px-6 py-4 text-right">จัดการ</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {books.map((b) => (
                            <tr key={b.book} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-6 py-4 font-mono text-sm text-gray-500">{b.book}</td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <span className={`w-8 h-8 flex items-center justify-center rounded-lg bg-${b.color}-100 text-${b.color}-600`}>
                                            {b.icon}
                                        </span>
                                        <div>
                                            <div className="font-medium text-gray-900">{b.th}</div>
                                            <div className="text-xs text-gray-400 font-arabic">{b.ar}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 w-1/4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold w-10 text-right">{b.percentage}%</span>
                                        <div className="w-full bg-gray-100 rounded-full h-2">
                                            <div
                                                className="bg-primary h-2 rounded-full transition-all duration-500"
                                                style={{ width: `${b.percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-center text-sm">
                                    <div className="text-gray-900 font-medium">{b.translated.toLocaleString()}</div>
                                    <div className="text-xs text-gray-400">จาก {b.total.toLocaleString()}</div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button
                                            onClick={() => handleOpenModal(b)}
                                            className="p-1 px-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded text-sm transition-colors"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(b.book)}
                                            className="p-1 px-3 bg-red-50 hover:bg-red-100 text-red-600 rounded text-sm transition-colors"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="font-bold text-lg text-gray-800">
                                {editingBook ? 'แก้ไขข้อมูลหนังสือ' : 'เพิ่มหนังสือใหม่'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {!editingBook && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Book ID (Slug)</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                        placeholder="e.g. riyad, bukhari"
                                        value={formData.book}
                                        onChange={e => setFormData({ ...formData, book: e.target.value })}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">ภาษาอังกฤษ ตัวเล็ก ห้ามเว้นวรรค</p>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อไทย</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                        value={formData.th}
                                        onChange={e => setFormData({ ...formData, th: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">ชื่ออาหรับ</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-arabic"
                                        value={formData.ar}
                                        onChange={e => setFormData({ ...formData, ar: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">รายละเอียด</label>
                                <textarea
                                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none h-24 resize-none"
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                        placeholder="emoji e.g. 📖"
                                        value={formData.icon}
                                        onChange={e => setFormData({ ...formData, icon: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Color Theme</label>
                                    <select
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                        value={formData.color}
                                        onChange={e => setFormData({ ...formData, color: e.target.value })}
                                    >
                                        <option value="blue">Blue</option>
                                        <option value="green">Green</option>
                                        <option value="purple">Purple</option>
                                        <option value="orange">Orange</option>
                                        <option value="red">Red</option>
                                    </select>
                                </div>
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
                                    {editingBook ? 'บันทึกแก้ไข' : 'สร้างหนังสือ'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
