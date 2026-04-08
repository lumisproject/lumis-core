import { useEffect, useState } from 'react';
import { API_BASE } from '../lib/supabase';

export function useIngestionStream(projectId: string | null | undefined) {
    const [status, setStatus] = useState<any>(null);

    useEffect(() => {
        if (!projectId) return;

        // Open the single, persistent connection
        const eventSource = new EventSource(`${API_BASE}/api/ingest/status/${projectId}/stream`);

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            setStatus(data);

            // Automatically close the connection when the backend says it's done
            if (data.status === 'ready' || data.status === 'error') {
                eventSource.close();
            }
        };

        // Cleanup if the component unmounts
        return () => {
            eventSource.close();
        };
    }, [projectId]);

    return status;
}