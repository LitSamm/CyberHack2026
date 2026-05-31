import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''; 

// This endpoint can be called by Vercel Cron or manually to scan for overdue QC
export async function GET(req: Request) {
  try {
    const expectedSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get('authorization');
    if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sb = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
    
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    // Find pending QC materials older than 24 hours
    const { data: overdueMaterials, error } = await sb
      .from('incoming_materials')
      .select('id, material_name, received_date')
      .eq('qc_status', 'pending')
      .lt('received_date', cutoff24h);

    if (error) throw error;

    if (!overdueMaterials || overdueMaterials.length === 0) {
      return NextResponse.json({ success: true, message: 'Tidak ada material QC overdue.' });
    }

    // Get all QC users
    const { data: qcUsers } = await sb.from('users').select('id').eq('role', 'qc');
    if (!qcUsers || qcUsers.length === 0) {
      return NextResponse.json({ success: true, message: 'Tidak ada user QC ditemukan.' });
    }

    // Check existing notifications to avoid spamming every 30 mins
    // We only create one 'qc_overdue' per material per day ideally, but for simplicity, 
    // we'll just check if a notification for this material already exists in the last 24h.
    const recentNotifCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentNotifs } = await sb
      .from('notifications')
      .select('message')
      .eq('type', 'qc_overdue')
      .gt('created_at', recentNotifCutoff);

    let createdCount = 0;

    for (const material of overdueMaterials) {
      const isAlreadyNotified = recentNotifs?.some(n => n.message.includes(material.material_name));
      
      if (!isAlreadyNotified) {
        // Create notification for each QC user
        const notifsToInsert = qcUsers.map(u => ({
          user_id: u.id,
          type: 'qc_overdue',
          title: 'QC Overdue Peringatan',
          message: `Material ${material.material_name} telah tertunda untuk QC lebih dari 24 jam.`,
          // Note: we don't link lot_id because it's a material not yet processed to lot, unless we linked material_id.
          // The schema only has lot_id, so we leave it null.
          is_read: false
        }));

        await sb.from('notifications').insert(notifsToInsert);
        createdCount++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Berhasil mengecek. Dibuat ${createdCount} notifikasi baru.` 
    });

  } catch (error: any) {
    console.error('Cron Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
