import { NextResponse } from 'next/server';

// Python FastAPI Server URL
const CV_SERVER_URL = 'http://localhost:8000/analyze';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No image file provided' },
        { status: 400 }
      );
    }

    // Forward the file to the Python CV Server
    // Create a new FormData object for the fetch request
    const pythonFormData = new FormData();
    pythonFormData.append('file', file);

    const response = await fetch(CV_SERVER_URL, {
      method: 'POST',
      body: pythonFormData,
      // Abort after 10 seconds to avoid hanging indefinitely if Python server is down
      signal: AbortSignal.timeout(10000), 
    });

    if (!response.ok) {
      throw new Error(`CV server responded with status ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error: any) {
    console.error('CV Analysis Error:', error);
    
    // Provide a graceful fallback error message
    const isNetworkError = error.name === 'TypeError' || error.message.includes('fetch');
    
    return NextResponse.json(
      { 
        error: isNetworkError 
          ? 'Gagal terhubung ke AI Server (Python). Pastikan cv_server.py sedang berjalan di port 8000.' 
          : 'Terjadi kesalahan saat menganalisis gambar.'
      },
      { status: 503 }
    );
  }
}
