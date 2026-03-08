import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode } from 'lucide-react';

export default function QRJoin({ roomId }) {
  const joinURL = `${window.location.origin}/room/${roomId}`;

  return (
    <div className="qr-join">
      <div className="qr-header">
        <QrCode size={24} />
        <h3>Scan to Join</h3>
      </div>
      
      <div className="qr-code-container">
        <QRCodeSVG
          value={joinURL}
          size={200}
          level="H"
          includeMargin={true}
          bgColor="#ffffff"
          fgColor="#000000"
        />
      </div>

      <div className="qr-info">
        <p className="room-code">Room Code: <strong>{roomId}</strong></p>
        <p className="room-url">{joinURL}</p>
      </div>
    </div>
  );
}
