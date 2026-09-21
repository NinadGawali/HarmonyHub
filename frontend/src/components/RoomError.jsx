import React from 'react';
import { DoorClosed } from 'lucide-react';
import { Button, EmptyState } from './ui';

// Full-page message for rooms that cannot be opened (missing, expired, not the host...).
export default function RoomError({ message, action }) {
  return (
    <div className="container">
      <EmptyState
        icon={DoorClosed}
        title="Can't open this room"
        description={message}
        action={action || <Button to="/party" variant="secondary">Go to Party</Button>}
      />
    </div>
  );
}
