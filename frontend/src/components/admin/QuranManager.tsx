import React, { useState, useEffect } from 'react';

// Types
interface Surah {
    id: number;
    name_arabic: string;
    name_simple: string;
    name_complex?: string;
}

interface Ayah {
    _id: string;
    verse_key: string;
    text_uthmani: string;
    translation_th?: string;
    tafsir_th?: string;
    tafsir_ar?: string;
    status?: string;
}

export default function QuranManager() {
    const [surahs, setSurahs] = useState<Surah[]>([]);
    const [selectedSurah, setSelectedSurah] = useState<string>('1');
    const [ayahs, setAyahs] = useState<Ayah[]>([]);
    const [loading, setLoading] = useState(false);

    // Edit Modal
    const [editingAyah, setEditingAyah] = useState<Ayah | null>(null);
    const [formData, setFormData] = useState({
        translation: '',
        tafsir: ''
    });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    const API_URL = import.meta.env.PUBLIC_API_URL || 'http://localhost:3000';

    useEffect(() => {
        loadSurahs();
    }, []);

    useEffect(() => {
        if (selectedSurah) {
            loadAyahs(selectedSurah);
        }
    }, [selectedSurah]);

    async function loadSurahs() {
        try {
            const res = await fetch(`${API_URL}/api/quran/surahs`);
            const data = await res.json();
            setSurahs(data.surahs);
        } catch (e) {
            console.error(e);
        }
    }

    async function loadAyahs(surahId: string) {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/quran/surah/${surahId}`);
            const data = await res.json();
            setAyahs(data.ayahs);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    function handleEdit(ayah: Ayah) {
        setEditingAyah(ayah);
        setFormData({
            translation: ayah.translation_th || '',
            tafsir: ayah.tafsir_th || ''
        });
        setIsModalOpen(true);
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        if (!editingAyah) return;

        setSaving(true);
        try {
            const res = await fetch(`${API_URL}/api/quran/ayah/${editingAyah._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    translation_th: formData.translation,
                    tafsir_th: formData.tafsir
                })
            });

            if (res.ok) {
                // Refresh local data
                setAyahs(prev => prev.map(a =>
                    a._id === editingAyah._id
                        ? { ...a, translation_th: formData.translation, tafsir_th: formData.tafsir, status: 'translated' }
                        : a
                ));
                setIsModalOpen(false);
            } else {
                alert('Save failed');
            }
        } catch (e) {
            console.error(e);
            alert('Error saving');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start md:items-center flex-col md:flex-row gap-4">
                <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500">
                    จัดการข้อมูลอัลกุรอาน
                </h2>
                <select
                    value={selectedSurah}
                    onChange={(e) => setSelectedSurah(e.target.value)}
                    className="px-4 py-2 border border-gray-200 rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-emerald-500/20 outline-none w-full md:w-auto"
                >
                    {surahs.map(s => (
                        <option key={s.id} value={s.id}>{s.id}. {s.name_simple} ({s.name_arabic})</option>
                    ))}
                </select>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {loading ? (
                    <div className="p-10 text-center text-emerald-600 animate-pulse">กำลังโหลดข้อมูล...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                                <tr>
                                    <th className="px-6 py-4 w-24">Ayah</th>
                                    <th className="px-6 py-4 text-right w-1/4">Arabic</th>
                                    <th className="px-6 py-4 w-1/4">Translation (TH)</th>
                                    <th className="px-6 py-4 w-1/4">Tafsir (TH)</th>
                                    <th className="px-6 py-4 text-right w-24">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {ayahs.map(ayah => (
                                    <tr key={ayah._id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 text-xs font-mono text-gray-500 whitespace-nowrap align-top pt-6">
                                            {ayah.verse_key}
                                        </td>
                                        <td className="px-6 py-4 text-right font-arabic text-xl leading-loose align-top text-gray-800" dir="rtl">
                                            {ayah.text_uthmani}
                                        </td>
                                        <td className="px-6 py-4 text-sm align-top leading-relaxed text-gray-700">
                                            {ayah.translation_th || <span className="text-red-300 italic">ยังไม่มีคำแปล</span>}
                                        </td>
                                        <td className="px-6 py-4 text-sm align-top leading-relaxed text-gray-600">
                                            {ayah.tafsir_th ? (
                                                <span className="line-clamp-3" title={ayah.tafsir_th}>{ayah.tafsir_th}</span>
                                            ) : (
                                                <span className="text-orange-300 italic">ยังไม่มีตัฟซีร</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right align-top pt-6">
                                            <button
                                                onClick={() => handleEdit(ayah)}
                                                className="text-emerald-600 hover:text-emerald-800 font-medium px-3 py-1 rounded-lg hover:bg-emerald-50 transition-colors"
                                            >
                                                แก้ไข
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {isModalOpen && editingAyah && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto flex flex-col">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="font-bold text-lg text-gray-800">
                                แก้ไขอายะห์ {editingAyah.verse_key}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-6 flex-1 overflow-y-auto">

                            <div className="bg-emerald-50/50 p-6 rounded-xl border border-emerald-100/50 text-right">
                                <label className="block text-xs font-medium text-emerald-600 mb-2 uppercase text-left">ข้อความภาษาอาหรับ</label>
                                <p className="font-arabic text-2xl leading-loose mb-4 text-gray-800" dir="rtl">{editingAyah.text_uthmani}</p>
                                {editingAyah.tafsir_ar && (
                                    <div className="mt-4 pt-4 border-t border-emerald-200/30">
                                        <p className="text-sm font-bold text-gray-500 mb-2 font-arabic" dir="rtl">Tafsir Al-Jalalayn</p>
                                        <p className="text-base text-gray-600 font-arabic leading-relaxed" dir="rtl">{editingAyah.tafsir_ar}</p>
                                    </div>
                                )}
                            </div>

                            <div className="grid md:grid-cols-1 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">คำแปล (TH)</label>
                                    <textarea
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl min-h-[100px] focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                                        value={formData.translation}
                                        onChange={e => setFormData({ ...formData, translation: e.target.value })}
                                        placeholder="ใส่คำแปล..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">ตัฟซีร (TH)</label>
                                    <textarea
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl min-h-[150px] focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-sans"
                                        value={formData.tafsir}
                                        onChange={e => setFormData({ ...formData, tafsir: e.target.value })}
                                        placeholder="ใส่คำอธิบาย..."
                                    />
                                    <p className="text-xs text-gray-400 mt-2">
                                        Tip: แปลความหมายจาก Tafsir Al-Jalalayn ด้านบน
                                    </p>
                                </div>
                            </div>
                        </form>

                        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3 sticky bottom-0">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="px-5 py-2.5 text-gray-600 hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-200 rounded-xl transition-all font-medium"
                            >
                                ยกเลิก
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={saving}
                                className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {saving ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                        กำลังบันทึก...
                                    </>
                                ) : 'บันทึกการเปลี่ยนแปลง'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
