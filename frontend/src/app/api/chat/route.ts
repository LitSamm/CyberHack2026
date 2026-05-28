import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''; 

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message } = body;

    if (!message) {
      return NextResponse.json({ error: 'Pesan diperlukan' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ 
        error: 'API Key Gemini belum diatur di server (.env.local)', 
        answer: 'Maaf, API Key AI (Gemini) belum dikonfigurasi. Silakan tambahkan GEMINI_API_KEY di .env.local.',
        suggested_actions: []
      }, { status: 500 });
    }

    // 1. Gather Operational Snapshot Data from Supabase
    const sb = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
    
    const today = new Date().toISOString().split('T')[0];
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const [
      { count: pendingQcCount },
      { count: overdueQcCount },
      { data: activeSchedules },
      { data: slotsData },
      { data: recentDispatches },
      { count: todayLotCount },
      { data: todayQcData }
    ] = await Promise.all([
      sb.from('incoming_materials').select('*', { count: 'exact', head: true }).eq('qc_status', 'pending'),
      sb.from('incoming_materials').select('*', { count: 'exact', head: true }).eq('qc_status', 'pending').lt('received_date', cutoff24h),
      sb.from('ppic_schedules').select('id, lots(lot_number)').in('status', ['queued', 'in_production']),
      sb.from('warehouse_slots').select('is_occupied, temperature_zone'),
      sb.from('dispatches').select('status, customer_name, destination').order('dispatch_date', { ascending: false }).limit(5),
      sb.from('lots').select('*', { count: 'exact', head: true }).gte('created_at', today),
      sb.from('qc_checks').select('result').gte('checked_at', today)
    ]);

    const totalSlots = slotsData?.length || 0;
    const occupiedSlots = slotsData?.filter(s => s.is_occupied).length || 0;
    const coldChainSlots = slotsData?.filter(s => s.temperature_zone !== 'normal').length || 0;
    const coldChainOccupied = slotsData?.filter(s => s.temperature_zone !== 'normal' && s.is_occupied).length || 0;

    const totalQcToday = todayQcData?.length || 0;
    const passedQcToday = todayQcData?.filter(c => c.result === 'pass').length || 0;
    const passRate = totalQcToday > 0 ? Math.round((passedQcToday / totalQcToday) * 100) : 0;

    const snapshotText = `
--- DATA OPERASIONAL TERKINI ---
- Material Pending QC: ${pendingQcCount} total (${overdueQcCount} sudah lewat 24 jam dan mendesak)
- Jadwal PPIC Aktif: ${activeSchedules?.length || 0} lot sedang diproses
- Gudang: Kapasitas ${occupiedSlots}/${totalSlots} slot terisi.
- Gudang Cold-Chain (-4°C & -20°C): Kapasitas ${coldChainOccupied}/${coldChainSlots} slot terisi.
- Pengiriman (Dispatches) Terbaru: ${(recentDispatches || []).map(d => `${d.customer_name} (${d.status})`).join(', ') || 'Belum ada'}
- Performa Hari Ini: ${todayLotCount} Lot diproduksi. QC Pass Rate: ${passRate}% dari ${totalQcToday} pengecekan.
--------------------------------
`;

    // 2. Call Gemini API
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const prompt = `Kamu adalah asisten operasional AromOS untuk Sima Arome. Jawab dalam Bahasa Indonesia yang ringkas, ramah, dan profesional.
Gunakan data operasional berikut (snapshot) untuk menjawab pertanyaan user:
${snapshotText}

Jika ditanya sesuatu yang tidak ada di data, katakan bahwa data tersebut tidak tersedia di sistem saat ini.
Jangan mengarang data. Berikan jawaban yang tepat dan langsung.

PENTING: Output Anda harus berupa format JSON murni dengan struktur berikut:
{
  "answer": "Jawaban teks untuk user dalam format Markdown",
  "suggested_actions": [
    { "label": "Label singkat tombol (misal: Buka QC Dashboard)", "url": "URL navigasi internal (misal: /qc, /warehouse, /ppic, /dispatch)" }
  ]
}
Berikan maksimal 3 suggested_actions yang relevan. Jika tidak ada yang relevan, kosongkan array.

Pertanyaan User: ${message}
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    const parsedResponse = JSON.parse(responseText);

    return NextResponse.json({
      answer: parsedResponse.answer,
      suggested_actions: parsedResponse.suggested_actions || []
    });

  } catch (error: any) {
    console.error('Chat API Error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal Server Error' 
    }, { status: 500 });
  }
}
