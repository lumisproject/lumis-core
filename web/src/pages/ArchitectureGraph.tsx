import { useEffect, useState } from 'react';
import { useProjectStore } from '@/stores/useProjectStore';
import { API_BASE } from '@/lib/supabase';
import MacroArchitectureGraph from '@/components/visualization/MacroArchitectureGraph';

export default function ArchitectureGraph() {
    const { project } = useProjectStore();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!project?.id) return;

        const fetchGraph = async () => {
            setLoading(true);
            try {
                const res = await fetch(`${API_BASE}/api/projects/${project.id}/architecture-graph`);
                if (!res.ok) {
                    throw new Error('Failed to fetch architecture graph metrics');
                }
                const result = await res.json();
                setData(result);
                setError(null);
            } catch (err: any) {
                console.error('Architecture fetch error:', err);
                setError(err.message || 'Error pulling dependency graph');
            } finally {
                setLoading(false);
            }
        };

        fetchGraph();
    }, [project?.id]);


    return (
        <div className="w-full h-full bg-gray-900 relative">
            {loading && (
                <div className="absolute inset-0 z-50 flex flex-col gap-4 items-center justify-center bg-gray-900/80 backdrop-blur-md">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
                    <p className="text-indigo-400 font-medium animate-pulse">Rendering Codebase Topology...</p>
                </div>
            )}
            
            {error && !loading && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-gray-900 text-center px-4">
                    <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4 border border-red-500/20">
                       <span className="text-red-500 text-2xl font-bold">!</span>
                    </div>
                    <p className="text-red-400 font-medium text-lg">{error}</p>
                    <p className="text-gray-500 text-sm mt-2">Ensure the digital twin server is running</p>
                </div>
            )}

            {!loading && !error && <MacroArchitectureGraph data={data} />}
        </div>
    );
}
