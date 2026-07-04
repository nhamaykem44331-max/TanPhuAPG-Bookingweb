import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'TAN PHU APG - Corporate Aviation Services';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%',
          background: 'linear-gradient(135deg, #c8a96b 0%, #f0d890 50%, #c8a96b 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <div style={{
          width: 1100, height: 550,
          background: 'white', borderRadius: 24,
          padding: '60px', display: 'flex', alignItems: 'center', gap: 50,
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        }}>
          {/* Logo placeholder */}
          <div style={{
            width: 160, height: 160, borderRadius: 20,
            background: 'linear-gradient(135deg, #c8a96b, #e8d4a0)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 60, fontWeight: 900, color: 'white',
          }}>✈</div>

          {/* Divider */}
          <div style={{ width: 4, height: 160, background: 'linear-gradient(to bottom, #c8a96b, #e8d4a0)', borderRadius: 2 }} />

          {/* Text */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 56, fontWeight: 900, color: '#1a1a1a', letterSpacing: 2 }}>TAN PHU APG</div>
            <div style={{ fontSize: 26, color: '#c8a96b', fontWeight: 600, marginTop: 8 }}>Corporate Aviation Services</div>
            <div style={{ fontSize: 22, color: '#666', marginTop: 20, lineHeight: 1.5 }}>
              So sánh & tìm kiếm vé máy bay{'\n'}nội địa và quốc tế giá tốt nhất
            </div>
            <div style={{ marginTop: 30, fontSize: 24, fontWeight: 700, color: '#1a1a1a' }}>
              📞 0918.752.686 · book.tanphuapg.com
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
