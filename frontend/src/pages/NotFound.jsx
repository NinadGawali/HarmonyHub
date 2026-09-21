import React from 'react';
import { Compass } from 'lucide-react';
import { Button, EmptyState } from '../components/ui';

export default function NotFound() {
  return (
    <div className="container">
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="The link may be old or mistyped."
        action={<Button to="/">Go home</Button>}
      />
    </div>
  );
}
