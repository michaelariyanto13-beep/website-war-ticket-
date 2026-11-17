import { useEffect, useState } from 'react';

export const ticketLink = (code) => `${window.location.origin}/ticket/${code}`;

/** QR tiket (isi = link tiket online). Library qrcode dimuat hanya saat dibutuhkan. */
export default function TicketQR({ code, size = 240 }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let alive = true;
    import('qrcode').then(({ default: QRCode }) =>
      QRCode.toDataURL(ticketLink(code), { width: size * 2, margin: 2, errorCorrectionLevel: 'M' })
    ).then((url) => alive && setSrc(url));
    return () => { alive = false; };
  }, [code, size]);

  return (
    <div className="w-qr" style={{ width: size, height: size }}>
      {src ? <img src={src} width={size} height={size} alt="QR tiket" /> : <span className="w-qr-load" />}
    </div>
  );
}
