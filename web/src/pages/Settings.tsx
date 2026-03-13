import { useNavigate } from 'react-router-dom';
import { supabase, API_BASE } from '@/lib/supabase';
import { AuthGuard } from '@/components/AuthGuard';
import { useUserStore } from '@/stores/useUserStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Plug, Loader2, BookOpen, Save, Sparkles, CreditCard, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

const SettingsContent = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useUserStore();
  const { 
    jiraConnected, fetchJiraStatus, disconnectJira, 
    notionConnected, fetchNotionStatus, disconnectNotion,
    project: currentProject 
  } = useProjectStore();
  
  const [availableJiraProjects, setAvailableJiraProjects] = useState<{key: string, name: string}[]>([]);
  const [loadingJiraProjects, setLoadingJiraProjects] = useState(false);
  const [availableNotionDatabases, setAvailableNotionDatabases] = useState<{id: string, name: string}[]>([]);
  const [loadingNotionDatabases, setLoadingNotionDatabases] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingConfig, setIsFetchingConfig] = useState(true);
  
  // Billing State
  const [billingInfo, setBillingInfo] = useState<any>(null);
  const [isManagingBilling, setIsManagingBilling] = useState(false);

  const {
    useDefault, provider, apiKey, selectedModel, jiraProjectKey, notionDatabaseId,
    setUseDefault, setProvider, setApiKey, setSelectedModel, setJiraProjectKey, setNotionDatabaseId
  } = useSettingsStore();

  const userId = user?.id || '';
  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [localModel, setLocalModel] = useState(selectedModel);

  useEffect(() => setLocalApiKey(apiKey), [apiKey]);
  useEffect(() => setLocalModel(selectedModel), [selectedModel]);

  const handleApiKeyBlur = () => { if (localApiKey !== apiKey) setApiKey(localApiKey); };
  const handleModelBlur = () => { if (localModel !== selectedModel) setSelectedModel(localModel); };

  // Fetch Config
  useEffect(() => {
    const fetchUserConfig = async () => {
      if (!userId) return;
      setIsFetchingConfig(true);
      try {
        const { data, error } = await supabase.from('user_settings').select('user_config').eq('user_id', userId).maybeSingle();
        if (data && data.user_config) {
          const config = data.user_config;
          setUseDefault(config.use_default !== false); 
          if (config.provider) setProvider(config.provider);
          if (config.model) { setSelectedModel(config.model); setLocalModel(config.model); }
          if (config.api_key) { setApiKey("••••••••••••••••"); setLocalApiKey("••••••••••••••••"); }
        } else {
          setUseDefault(true);
        }
      } catch (err) { console.error("Failed to load user config:", err); } 
      finally { setIsFetchingConfig(false); }
    };
    fetchUserConfig();
  }, [userId, setUseDefault, setProvider, setSelectedModel, setApiKey]);

  // Fetch Billing/Usage Info
  useEffect(() => {
    const fetchBillingInfo = async () => {
      if (!userId) return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`${API_BASE}/api/billing/usage`, {
          headers: { 'Authorization': `Bearer ${session?.access_token}` }
        });
        if (res.ok) setBillingInfo(await res.json());
      } catch (err) { console.error("Failed to load billing info:", err); }
    };
    fetchBillingInfo();
  }, [userId]);

  // Fetch Integrations
  useEffect(() => {
    if (userId) { fetchJiraStatus(userId); fetchNotionStatus(userId); }
  }, [userId, fetchJiraStatus, fetchNotionStatus]);

  useEffect(() => {
    const fetchJiraProjects = async () => {
      if (jiraConnected && userId) {
        setLoadingJiraProjects(true);
        try {
          const res = await fetch(`${API_BASE}/api/jira/projects/${userId}`);
          if (res.ok) setAvailableJiraProjects(await res.json());
        } catch (error) { console.error("Failed to fetch Jira projects:", error); } 
        finally { setLoadingJiraProjects(false); }
      }
    };
    fetchJiraProjects();
  }, [jiraConnected, userId]);

  useEffect(() => {
    const fetchNotionDatabases = async () => {
      if (notionConnected && userId) {
        setLoadingNotionDatabases(true);
        try {
          const res = await fetch(`${API_BASE}/api/notion/databases/${userId}`);
          if (res.ok) setAvailableNotionDatabases(await res.json());
        } catch (error) { console.error("Failed to fetch Notion databases:", error); } 
        finally { setLoadingNotionDatabases(false); }
      }
    };
    fetchNotionDatabases();
  }, [notionConnected, userId]);

  const handleSaveConfig = async () => {
    if (!userId) return;
    if (!useDefault && (!localApiKey?.trim() || !localModel?.trim())) {
      toast({ title: "Missing Information", description: "Please provide an API Key and a Model ID.", variant: "destructive" });
      return; 
    }
    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const payload = { provider, apiKey: localApiKey, selectedModel: localModel, useDefault };
      const res = await fetch(`${API_BASE}/api/settings/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify(payload)
      });
      if (res.ok) toast({ title: "Settings Saved", description: "Your configuration has been safely stored." });
      else throw new Error((await res.json()).detail || "Failed to save");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally { setIsSaving(false); }
  };

  const handleManageBilling = async () => {
    setIsManagingBilling(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_BASE}/api/billing/create-portal-session`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      window.location.href = data.url;
    } catch (error: any) {
      toast({ title: "Cannot access portal", description: "You might be on the Free plan, or an error occurred.", variant: "destructive" });
    } finally { setIsManagingBilling(false); }
  };

  const handleJiraConnect = () => window.location.href = `${API_BASE}/auth/jira/connect?state=${userId}`;
  const handleNotionConnect = () => window.location.href = `${API_BASE}/auth/notion/connect?state=${userId}`;

  // INTEGRATION HANDLERS
  const handleJiraProjectSelect = async (key: string) => {
    setJiraProjectKey(key);
    if (currentProject?.id) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        await fetch(`${API_BASE}/api/projects/${currentProject.id}/jira-mapping`, {
          method: 'POST', 
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}` 
          },
          body: JSON.stringify({ jira_project_id: key })
        });
      } catch (error) { console.error("Failed to save Jira mapping", error); }
    }
  };

  const handleNotionDatabaseSelect = async (id: string) => {
    setNotionDatabaseId(id);
    if (currentProject?.id) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        await fetch(`${API_BASE}/api/projects/${currentProject.id}/notion-mapping`, {
          method: 'POST', 
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}` 
          },
          body: JSON.stringify({ notion_project_id: id })
        });
      } catch (error) { console.error("Failed to save Notion mapping", error); }
    }
  };

  if (isFetchingConfig) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Calculate usage percentage
  const usagePercentage = billingInfo 
    ? Math.min((billingInfo.usage.query_count / billingInfo.limits.queries) * 100, 100) 
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-2xl py-12 space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold">Settings</h1>
          </div>
          
          <Button onClick={handleSaveConfig} disabled={isSaving} className="gap-2 shadow-sm">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save LLM Settings
          </Button>
        </div>

        {/* BILLING & SUBSCRIPTION */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-5 shadow-sm relative overflow-hidden">
          {/* Push the background icon further up and right so it doesn't overlap the button */}
          <div className="absolute -top-6 -right-4 p-6 opacity-10 pointer-events-none">
            <CreditCard className="w-28 h-28" />
          </div>
          
          <div className="flex items-center gap-2 mb-1 relative z-10">
            <CreditCard className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-lg">Billing & Usage</h2>
          </div>

          {billingInfo ? (
            <div className="space-y-6 relative z-10">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-sm text-muted-foreground">Current Plan</p>
                  <p className="text-2xl font-bold capitalize tracking-tight">{billingInfo.tier} Plan</p>
                </div>
                {billingInfo.tier === 'free' ? (
                  <Button variant="default" onClick={() => navigate('/pricing')} className="shadow-sm">
                    Upgrade Plan
                  </Button>
                ) : (
                  <Button variant="outline" onClick={handleManageBilling} disabled={isManagingBilling} className="shadow-sm">
                    {isManagingBilling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ExternalLink className="h-4 w-4 mr-2" />}
                    Manage Subscription
                  </Button>
                )}
              </div>

              {/* USAGE METRICS GRID */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* 1. LLM Queries */}
                <div className="space-y-2 bg-secondary/30 p-4 rounded-lg border border-border/50">
                  <div className="flex justify-between text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <span>LLM Queries</span>
                    <span className="text-foreground">
                      {billingInfo.usage.query_count} / {billingInfo.limits.queries === null ? '∞' : billingInfo.limits.queries}
                    </span>
                  </div>
                  <Progress value={billingInfo.limits.queries === null ? 0 : Math.min((billingInfo.usage.query_count / billingInfo.limits.queries) * 100, 100)} className="h-1.5" />
                </div>

                {/* 2. Projects */}
                <div className="space-y-2 bg-secondary/30 p-4 rounded-lg border border-border/50">
                  <div className="flex justify-between text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <span>Active Projects</span>
                    <span className="text-foreground">
                      {billingInfo.usage.project_count} / {billingInfo.limits.projects === null ? '∞' : billingInfo.limits.projects}
                    </span>
                  </div>
                  <Progress value={billingInfo.limits.projects === null ? 0 : Math.min((billingInfo.usage.project_count / billingInfo.limits.projects) * 100, 100)} className="h-1.5" />
                </div>

                {/* 3. Vector Storage */}
                <div className="space-y-2 bg-secondary/30 p-4 rounded-lg border border-border/50">
                  <div className="flex justify-between text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <span>Vector Storage</span>
                    <span className="text-foreground">
                      {billingInfo.usage.storage_gb < 0.01 && billingInfo.usage.storage_gb > 0 ? '< 0.01' : billingInfo.usage.storage_gb?.toFixed(2)} / {billingInfo.limits.storage_gb === null ? '∞' : `${billingInfo.limits.storage_gb} GB`}
                    </span>
                  </div>
                  <Progress value={billingInfo.limits.storage_gb === null ? 0 : Math.min((billingInfo.usage.storage_gb / billingInfo.limits.storage_gb) * 100, 100)} className="h-1.5" />
                </div>

              </div>
              <p className="text-xs text-muted-foreground mt-2">LLM Query usage resets at the beginning of each calendar month. Storage is calculated dynamically.</p>
            </div>
          ) : (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading billing info...</span>
            </div>
          )}
        </div>

        {/* LLM Config */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-5 w-5 text-purple-500" />
            <h2 className="font-semibold text-lg">Lumis Intelligence</h2>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
            <div>
              <Label className="font-medium">Use System Default</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Use the Lumis optimized environment (recommended).</p>
            </div>
            <Switch checked={useDefault} onCheckedChange={setUseDefault} />
          </div>

          {!useDefault && (
            <div className="grid gap-4 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select value={provider} onValueChange={setProvider}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openrouter">OpenRouter</SelectItem>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                    <SelectItem value="google">Google Gemini</SelectItem>
                    <SelectItem value="groq">Groq</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>API Key</Label>
                <Input 
                  type="password" 
                  placeholder={apiKey ? "••••••••••••••••" : "Paste your API key here"} 
                  value={localApiKey} 
                  onChange={(e) => setLocalApiKey(e.target.value)} 
                  onBlur={handleApiKeyBlur} 
                />
              </div>

              <div className="space-y-2">
                <Label>Model ID</Label>
                <Input 
                  placeholder="e.g. gpt-4o or claude-3-5-sonnet-latest" 
                  value={localModel} 
                  onChange={(e) => setLocalModel(e.target.value)} 
                  onBlur={handleModelBlur} 
                />
              </div>
            </div>
          )}
        </div>

        {/* Integrations */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Jira */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4 shadow-sm">
            <h2 className="font-semibold text-lg flex items-center gap-2">Jira <Plug className="h-4 w-4 text-blue-500" /></h2>
            <p className="text-sm text-muted-foreground">
              {jiraConnected ? 'Connected to Atlassian.' : 'Sync your tickets with AI.'}
            </p>
            
            {jiraConnected ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase text-muted-foreground">Active Project</Label>
                  <Select value={jiraProjectKey} onValueChange={handleJiraProjectSelect} disabled={loadingJiraProjects || !currentProject}>
                    <SelectTrigger>
                      {loadingJiraProjects ? <Loader2 className="w-4 h-4 animate-spin" /> : <SelectValue placeholder={currentProject ? "Select Project" : "Open a project first"} />}
                    </SelectTrigger>
                    <SelectContent>
                      {availableJiraProjects.map((p) => (
                        <SelectItem key={p.key} value={p.key}>{p.name} ({p.key})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="secondary" size="sm" className="w-full text-xs" onClick={() => disconnectJira(userId)}>
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button variant="outline" className="w-full" onClick={handleJiraConnect}>Connect Jira</Button>
            )}
          </div>

          {/* Notion */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4 shadow-sm">
            <h2 className="font-semibold text-lg flex items-center gap-2">Notion <BookOpen className="h-4 w-4" /></h2>
            <p className="text-sm text-muted-foreground">
              {notionConnected ? 'Connected to Notion.' : 'Automate your Notion docs.'}
            </p>
            
            {notionConnected ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase text-muted-foreground">Active Database</Label>
                  <Select value={notionDatabaseId} onValueChange={handleNotionDatabaseSelect} disabled={loadingNotionDatabases || !currentProject}>
                    <SelectTrigger>
                      {loadingNotionDatabases ? <Loader2 className="w-4 h-4 animate-spin" /> : <SelectValue placeholder={currentProject ? "Select Database" : "Open a project first"} />}
                    </SelectTrigger>
                    <SelectContent>
                      {availableNotionDatabases.map((db) => (
                        <SelectItem key={db.id} value={db.id}>{db.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="secondary" size="sm" className="w-full text-xs" onClick={() => disconnectNotion(userId)}>
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button variant="outline" className="w-full" onClick={handleNotionConnect}>Connect Notion</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const SettingsPage = () => (
  <AuthGuard>
    <SettingsContent />
  </AuthGuard>
);

export default SettingsPage;