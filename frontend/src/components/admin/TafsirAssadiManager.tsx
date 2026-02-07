import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.PUBLIC_API_URL || 'http://localhost:3000';

interface TafsirEntry {
    id: string;
    surah_id: number;
    ayah_start: number;
    ayah_end: number;
    text_ar: string;
    text_th: string;
    translated_at?: string;
}

interface Stats {
    total: number;
    translated: number;
    untranslated: number;
    percentage: number;
}

export default function TafsirAssadiManager() {
    const [entries, setEntries] = useState<TafsirEntry[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedSurah, setSelectedSurah] = useState<number>(1);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editText, setEditText] = useState('');
    const [saving, setSaving] = useState(false);

    // Surah names for dropdown
    const surahNames = [
        'الفاتحة', 'البقرة', 'آل عمران', 'النساء', 'المائدة', 'الأنعام', 'الأعراف', 'الأنفال',
        'التوبة', 'يونس', 'هود', 'يوسف', 'الرعد', 'إبراهيم', 'الحجر', 'النحل',
        'الإسراء', 'الكهف', 'مريم', 'طه', 'الأنبياء', 'الحج', 'المؤمنون', 'النور',
        'الفرقان', 'الشعراء', 'النمل', 'القصص', 'العنكبوت', 'الروم', 'لقمان', 'السجدة',
        'الأحزاب', 'سبأ', 'فاطر', 'يس', 'الصافات', 'ص', 'الزمر', 'غافر',
        'فصلت', 'الشورى', 'الزخرف', 'الدخان', 'الجاثية', 'الأحقاف', 'محمد', 'الفتح',
        'الحجرات', 'ق', 'الذاريات', 'الطور', 'النجم', 'القمر', 'الرحمن', 'الواقعة',
        'الحديد', 'المجادلة', 'الحشر', 'الممتحنة', 'الصف', 'الجمعة', 'المنافقون', 'التغابن',
        'الطلاق', 'التحريم', 'الملك', 'القلم', 'الحاقة', 'المعارج', 'نوح', 'الجن',
        'المزمل', 'المدثر', 'القيامة', 'الإنسان', 'المرسلات', 'النبأ', 'النازعات', 'عبس',
        'التكوير', 'الانفطار', 'المطففين', 'الانشقاق', 'البروج', 'الطارق', 'الأعلى', 'الغاشية',
        'الفجر', 'البلد', 'الشمس', 'الليل', 'الضحى', 'الشرح', 'التين', 'العلق',
        'القدر', 'البينة', 'الزلزلة', 'العاديات', 'القارعة', 'التكاثر', 'العصر', 'الهمزة',
        'الفيل', 'قريش', 'الماعون', 'الكوثر', 'الكافرون', 'النصر', 'المسد', 'الإخلاص',
        'الفلق', 'الناس'
    ];

    useEffect(() => {
        fetchStats();
    }, []);

    useEffect(() => {
        fetchEntries();
    }, [selectedSurah, page]);

    const fetchStats = async () => {
        try {
            const res = await fetch(`${API_URL}/api/admin/tafsir-assadi/stats`);
            const data = await res.json();
            setStats(data);
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        }
    };

    const fetchEntries = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/tafsir-assadi?surah=${selectedSurah}&page=${page}&limit=20`);
            const data = await res.json();
            setEntries(data.entries || []);
            setTotalPages(data.pages || 1);
        } catch (err) {
            console.error('Failed to fetch entries:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (entry: TafsirEntry) => {
        setEditingId(entry.id);
        setEditText(entry.text_th);
    };

    const handleSave = async () => {
        if (!editingId) return;

        setSaving(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/tafsir-assadi/${editingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text_th: editText })
            });

            if (res.ok) {
                setEntries(prev => prev.map(e =>
                    e.id === editingId ? { ...e, text_th: editText } : e
                ));
                setEditingId(null);
                fetchStats();
            }
        } catch (err) {
            console.error('Failed to save:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setEditingId(null);
        setEditText('');
    };

    return (
        <div className="space-y-6">
            {/* Stats Card */}
            {stats && (
                <div className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl p-6 text-white">
                    <h2 className="text-xl font-bold mb-4">📘 ตัฟซีรอัซ-ซะอ์ดีย์</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white/20 rounded-xl p-4 text-center">
                            <div className="text-3xl font-bold">{stats.total.toLocaleString()}</div>
                            <div className="text-sm opacity-80">ทั้งหมด</div>
                        </div>
                        <div className="bg-white/20 rounded-xl p-4 text-center">
                            <div className="text-3xl font-bold text-green-200">{stats.translated.toLocaleString()}</div>
                            <div className="text-sm opacity-80">แปลแล้ว</div>
                        </div>
                        <div className="bg-white/20 rounded-xl p-4 text-center">
                            <div className="text-3xl font-bold text-yellow-200">{stats.untranslated.toLocaleString()}</div>
                            <div className="text-sm opacity-80">ยังไม่แปล</div>
                        </div>
                        <div className="bg-white/20 rounded-xl p-4 text-center">
                            <div className="text-3xl font-bold">{stats.percentage}%</div>
                            <div className="text-sm opacity-80">ความคืบหน้า</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Surah Selector */}
            <div className="bg-white rounded-xl shadow-sm border p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    เลือกสูเราะฮฺ
                </label>
                <select
                    value={selectedSurah}
                    onChange={(e) => { setSelectedSurah(parseInt(e.target.value)); setPage(1); }}
                    className="w-full md:w-auto px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                    {surahNames.map((name, i) => (
                        <option key={i + 1} value={i + 1}>
                            {i + 1}. {name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Entries List */}
            <div className="bg-white rounded-xl shadow-sm border divide-y">
                {loading ? (
                    <div className="p-8 text-center text-gray-500">กำลังโหลด...</div>
                ) : entries.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">ไม่พบข้อมูล</div>
                ) : (
                    entries.map(entry => (
                        <div key={entry.id} className="p-4 hover:bg-gray-50">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-blue-600">
                                    อายะฮฺ {entry.ayah_start}
                                    {entry.ayah_end !== entry.ayah_start && ` - ${entry.ayah_end}`}
                                </span>
                                {entry.text_th ? (
                                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                                        ✓ แปลแล้ว
                                    </span>
                                ) : (
                                    <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                                        รอแปล
                                    </span>
                                )}
                            </div>

                            {/* Arabic Text */}
                            <p className="text-right text-lg leading-loose mb-3 p-3 bg-gray-50 rounded-lg"
                                dir="rtl"
                                style={{ fontFamily: "'KFGQPC Hafs', serif" }}>
                                {entry.text_ar}
                            </p>

                            {/* Thai Translation */}
                            {editingId === entry.id ? (
                                <div className="space-y-2">
                                    <textarea
                                        value={editText}
                                        onChange={(e) => setEditText(e.target.value)}
                                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 min-h-[150px]"
                                        placeholder="พิมพ์คำแปลภาษาไทยที่นี่..."
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleSave}
                                            disabled={saving}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                        >
                                            {saving ? 'กำลังบันทึก...' : '💾 บันทึก'}
                                        </button>
                                        <button
                                            onClick={handleCancel}
                                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                                        >
                                            ยกเลิก
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-start justify-between gap-4">
                                    <p className="text-gray-700 leading-relaxed flex-1 whitespace-pre-wrap">
                                        {entry.text_th || <span className="text-gray-400 italic">ยังไม่มีคำแปล</span>}
                                    </p>
                                    <button
                                        onClick={() => handleEdit(entry)}
                                        className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 shrink-0"
                                    >
                                        ✏️ แก้ไข
                                    </button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center gap-2">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                    >
                        ← ก่อนหน้า
                    </button>
                    <span className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg">
                        หน้า {page} / {totalPages}
                    </span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                    >
                        ถัดไป →
                    </button>
                </div>
            )}
        </div>
    );
}
