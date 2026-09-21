import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy } from 'lucide-react';
import { Button } from './ui';
import styles from './ShareRoom.module.css';

// QR code, room code and a copyable link for inviting guests.
export default function ShareRoom({ roomId }) {
  const [copied, setCopied] = useState(false);
  const joinUrl = `${window.location.origin}/room/${roomId}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={styles.share}>
      <div className={styles.qr}>
        <QRCodeSVG value={joinUrl} size={196} level="M" includeMargin bgColor="#ffffff" fgColor="#0b0a10" />
      </div>
      <p className={styles.caption}>Scan to join, or enter the code</p>
      <p className={styles.code} aria-label={`Room code ${roomId.split('').join(' ')}`}>{roomId}</p>
      <div className={styles.link}>
        <span className={styles.url}>{joinUrl}</span>
        <Button variant="secondary" size="sm" icon={copied ? Check : Copy} onClick={copyLink}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  );
}
