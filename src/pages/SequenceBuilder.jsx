import React, { useMemo } from 'react';
import SequenceCanvas from '@/components/marketing/SequenceCanvas';

export default function SequenceBuilderPage() {
    // Parse query parameters
    const queryParams = new URLSearchParams(location.search);
    const sequenceId = queryParams.get('id');

    return <SequenceCanvas sequenceId={sequenceId} />;
}