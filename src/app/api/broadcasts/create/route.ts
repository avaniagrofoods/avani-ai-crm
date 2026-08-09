import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectToDatabase from '@/lib/db';
import { Broadcast } from '@/models/Broadcast';

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const body = await req.json();

    const { name, templateName, broadcastType, totalContacts, testMode } = body;

    let broadcastId = 'test_broadcast_' + Date.now();
    let dbMode = "test";
    
    try {
      if (mongoose.connection.readyState === 1) {
        const broadcast = await Broadcast.create({
          name: name || `Broadcast - ${new Date().toISOString()}`,
          templateName: templateName,
          broadcastType: broadcastType || 'whatsapp',
          status: 'Processing',
          totalContacts: totalContacts || 0,
          validContacts: totalContacts || 0,
          queuedCount: 0,
          sentCount: 0,
          deliveredCount: 0,
          readCount: 0,
          failedCount: 0,
          testMode: !!testMode,
          mode: !!testMode ? 'test' : 'production',
          environment: process.env.NODE_ENV || 'development'
        });
        broadcastId = broadcast._id;
        dbMode = "production";
      } else {
        console.warn("DB not connected. Proceeding with mock broadcast ID for test mode.");
      }
    } catch (e) {
      console.warn("DB Create Error:", e);
      if (!testMode) throw e;
    }

    return NextResponse.json({ 
      success: true, 
      broadcastId: broadcastId,
      mode: dbMode
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
