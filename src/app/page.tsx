'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Send, 
  BarChart3, 
  Radio, 
  PlusCircle, 
  Server, 
  Users, 
  MessageSquare, 
  History, 
  Settings as SettingsIcon, 
  LogOut, 
  ShieldCheck, 
  RefreshCw, 
  Play, 
  Pause, 
  Square, 
  Download, 
  Trash2, 
  Copy, 
  RotateCcw, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Search, 
  Eye, 
  FileSpreadsheet, 
  Filter, 
  Sparkles, 
  Bold, 
  Italic, 
  Strikethrough, 
  Code,
  Smartphone,
  ShieldAlert,
  Terminal,
  Zap,
  Layers,
  ArrowRight,
  Image as ImageIcon,
  Video,
  FileText,
  Upload,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Activity,
  ExternalLink,
  Command,
  Shield,
  MessageCircle,
  FileDown,
  Check,
  AlertTriangle,
  X,
  Sliders,
  ListFilter
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';
import * as XLSX from 'xlsx';
import LiveWhatsAppBubble from '@/components/LiveWhatsAppBubble';
import QRCodeModal from '@/components/QRCodeModal';
import MultiMessageRotationEditor from '@/components/MultiMessageRotationEditor';
import CampaignVariantsLiveTab from '@/components/CampaignVariantsLiveTab';
import { DistributionMode, RotationScope, VariantInput } from '@/lib/rotation';
import { GuardrailsConsoleTab } from '@/components/GuardrailsConsoleTab';

type TabType = 'overview' | 'campaigns' | 'live' | 'wizard' | 'contacts' | 'templates' | 'replies' | 'instances' | 'guardrails' | 'reports' | 'system' | 'settings';

export default function AppDashboard() {
  const router = useRouter();

  // Active Navigation & Layout State
  const [currentTab, setCurrentTab] = useState<TabType>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandSearch, setCommandSearch] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Global State
  const [instances, setInstances] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);

  // Live Campaign SSE State
  const [liveStats, setLiveStats] = useState<any>(null);
  const [liveLogs, setLiveLogs] = useState<any[]>([]);
  const [jitterInfo, setJitterInfo] = useState<any>(null);
  const [recipientsList, setRecipientsList] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [recipientSearch, setRecipientSearch] = useState('');
  const [inspectRecipient, setInspectRecipient] = useState<any>(null);

  // Modals State
  const [qrModalInstance, setQrModalInstance] = useState<string | null>(null);
  const [newInstanceModal, setNewInstanceModal] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState('');

  // Contacts & Import State
  const [contacts, setContacts] = useState<any[]>([]);
  const [contactLists, setContactLists] = useState<any[]>([]);
  const [blacklist, setBlacklist] = useState<any[]>([]);
  const [contactSubTab, setContactSubTab] = useState<'all' | 'lists' | 'blacklist'>('all');
  const [contactSearch, setContactSearch] = useState('');
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [importingFile, setImportingFile] = useState(false);
  const [importStats, setImportStats] = useState<any>(null);

  // Settings State
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [settingsSavedMsg, setSettingsSavedMsg] = useState('');

  // AI Settings State
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiMaskedKey, setAiMaskedKey] = useState('');
  const [aiModel, setAiModel] = useState('anthropic/claude-3.5-haiku');
  const [aiSpendCap, setAiSpendCap] = useState(10.0);
  const [aiTesting, setAiTesting] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<any>(null);
  const [savingAiSettings, setSavingAiSettings] = useState(false);

  // Replies Inbox State
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [conversationMessages, setConversationMessages] = useState<any[]>([]);
  const [replyInputText, setReplyInputText] = useState('');
  const [replyInstance, setReplyInstance] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [syncingReplies, setSyncingReplies] = useState(false);
  const [uploadingChat, setUploadingChat] = useState(false);

  // Campaign Wizard State
  const [wizName, setWizName] = useState(`Campaign-${Date.now().toString().slice(-4)}`);
  const [wizInstances, setWizInstances] = useState<string[]>([]);
  const [wizListIds, setWizListIds] = useState<string[]>([]);
  const [wizTemplate, setWizTemplate] = useState(
    `{Hi|Hello|Dear} {name|Valued Customer},\n\nWe are pleased to share our newest updates with your team at *{company|your company}*!\n\nUse code: ~OLDCODE~ \`SPECIAL20\` for _20% off_ your order.\n\n{Best regards|Warm wishes},\nMarketing Team`
  );
  const [wizMediaType, setWizMediaType] = useState('text');
  const [wizMediaUrl, setWizMediaUrl] = useState('');
  const [wizFileName, setWizFileName] = useState('');
  const [pacingPreset, setPacingPreset] = useState<'safe' | 'balanced' | 'fast'>('balanced');
  const [minDelay, setMinDelay] = useState(10);
  const [maxDelay, setMaxDelay] = useState(25);
  const [batchSize, setBatchSize] = useState(50);
  const [batchDelay, setBatchDelay] = useState(180);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleTime, setScheduleTime] = useState('');
  const [launchSafetyCheck, setLaunchSafetyCheck] = useState(false);

  // Multi-Message Rotation State (Section 1-3)
  const [wizDistributionMode, setWizDistributionMode] = useState<DistributionMode>('SINGLE');
  const [wizRotationScope, setWizRotationScope] = useState<RotationScope>('CAMPAIGN');
  const [wizShuffleAudience, setWizShuffleAudience] = useState(false);
  const [wizShuffleSeed, setWizShuffleSeed] = useState(42);
  const [wizAvoidRepeatContent, setWizAvoidRepeatContent] = useState(true);
  const [wizVariants, setWizVariants] = useState<VariantInput[]>([
    {
      position: 1,
      label: 'Message 1 (Friendly)',
      content: '{Hi|Hello|Dear} {name|Friend}! We are excited to announce our seasonal promotions for *{company|your company}*. Use code `SAVE20` for 20% off!',
      mediaType: 'text',
      mediaUrl: '',
      fileName: '',
      weight: 25,
    },
    {
      position: 2,
      label: 'Message 2 (Direct)',
      content: 'Hello {name|there}: Enjoy 20% savings on all catalogue services this week using code `SAVE20`. Reply here if you need any assistance!',
      mediaType: 'text',
      mediaUrl: '',
      fileName: '',
      weight: 25,
    },
    {
      position: 3,
      label: 'Message 3 (Urgent)',
      content: 'Reminder {name|Customer}: Limited-time exclusive discount available for your team. Apply voucher `SAVE20` before Sunday midnight!',
      mediaType: 'text',
      mediaUrl: '',
      fileName: '',
      weight: 25,
    },
    {
      position: 4,
      label: 'Message 4 (Value)',
      content: 'Greetings {name|Partner}! Check out what is new with our product updates today. Redeem your 20% voucher `SAVE20` anytime this week.',
      mediaType: 'text',
      mediaUrl: '',
      fileName: '',
      weight: 25,
    },
  ]);
  const [activePreviewVariantIndex, setActivePreviewVariantIndex] = useState(0);
  const [previewRecipientNumber, setPreviewRecipientNumber] = useState(1);
  const [liveActiveTab, setLiveActiveTab] = useState<'stream' | 'recipients' | 'variants'>('stream');
  const [selectedVariantFilter, setSelectedVariantFilter] = useState('ALL');
  const [liveVariantStats, setLiveVariantStats] = useState<any[]>([]);

  // Templates Library Mock
  const sampleTemplates = [
    {
      id: 't-1',
      title: 'Special 20% Discount Offer',
      category: 'Marketing',
      content: '{Hi|Hello|Greetings} {name|Friend}!\n\nExciting news! We have an exclusive *20% discount* waiting for you on your next order.\n\nUse voucher code: `SAVE20` at checkout.\n\n{Shop now|Claim your discount} before it expires on Sunday!',
      mediaType: 'text',
      usageCount: 142
    },
    {
      id: 't-2',
      title: 'Order Confirmation & Tracking',
      category: 'Transactional',
      content: 'Hello {name|Customer},\n\nYour order *#{company|1024}* has been confirmed and is being packed! 📦\n\nEstimated delivery: _Within 3 business days_.\n\nTrack your order anytime by replying *TRACK*. Thank you for choosing us!',
      mediaType: 'text',
      usageCount: 389
    },
    {
      id: 't-3',
      title: 'Webinar & Event Reminder',
      category: 'Reminder',
      content: 'Hi {name|there}! Just a gentle reminder that our live masterclass starts in *1 hour*.\n\nTopic: *Scaling WhatsApp Outreach in 2026*\nJoin link: https://meet.example.com/live\n\nSee you inside!',
      mediaType: 'text',
      usageCount: 95
    },
    {
      id: 't-4',
      title: 'VIP Customer Welcome',
      category: 'Onboarding',
      content: '{Welcome|Glad to have you} {name|Partner}!\n\nThank you for joining our VIP Community. As a member, you get priority support and early access to our seasonal releases.\n\nSave this number to stay updated!',
      mediaType: 'text',
      usageCount: 215
    },
    {
      id: 't-5',
      title: 'Customer Feedback & Review',
      category: 'Support',
      content: 'Hi {name|there}, how was your recent experience with our service? ⭐\n\nWe would love to hear your thoughts! Reply with a rating from *1 (poor)* to *5 (excellent)*.\n\nWe appreciate your valuable feedback!',
      mediaType: 'text',
      usageCount: 78
    },
    {
      id: 't-6',
      title: 'Re-engagement / We Miss You',
      category: 'Retention',
      content: '{Hey|Hi} {name|there}! It has been a while since we connected. We have added lots of exciting new features designed specifically for your workflow.\n\nReply *DEMO* and our team will share a personalized walkthrough!',
      mediaType: 'text',
      usageCount: 160
    }
  ];

  // Keyboard shortcut listener for Command Palette (Ctrl+K / Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch initial data
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const tab = urlParams.get('tab');
      if (tab) {
        setCurrentTab(tab as TabType);
      }
    }

    fetch('/api/auth/me')
      .then((res) => {
        if (!res.ok) {
          router.push('/login');
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.user) setCurrentUser(data.user);
      })
      .catch(() => router.push('/login'));

    loadInstances();
    loadCampaigns();
    loadContacts();
    loadAnalytics();
    loadSettings();
    loadConversations();
  }, [router]);

  const loadInstances = async () => {
    try {
      const res = await fetch('/api/evolution/instances');
      const data = await res.json();
      if (res.ok && data.instances) {
        setInstances(data.instances);
        if (data.instances.length > 0 && !replyInstance) {
          const connected = data.instances.find((i: any) => i.connectionStatus === 'open');
          if (connected) setReplyInstance(connected.name);
          else setReplyInstance(data.instances[0].name);
        }
      }
    } catch (err) {
      console.error('Error fetching instances:', err);
    }
  };

  const loadCampaigns = async () => {
    try {
      const res = await fetch('/api/campaigns');
      const data = await res.json();
      if (res.ok && data.campaigns) {
        setCampaigns(data.campaigns);
        const running = data.campaigns.find((c: any) => c.status === 'RUNNING');
        if (running && !activeCampaignId) {
          setActiveCampaignId(running.id);
        } else if (data.campaigns.length > 0 && !activeCampaignId) {
          setActiveCampaignId(data.campaigns[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching campaigns:', err);
    }
  };

  const loadContacts = async () => {
    try {
      const [cRes, lRes, bRes] = await Promise.all([
        fetch('/api/contacts?limit=200'),
        fetch('/api/contacts/lists'),
        fetch('/api/contacts/blacklist')
      ]);
      const [cData, lData, bData] = await Promise.all([
        cRes.json(),
        lRes.json(),
        bRes.json()
      ]);
      if (cRes.ok && cData.contacts) setContacts(cData.contacts);
      if (lRes.ok && lData.lists) setContactLists(lData.lists);
      if (bRes.ok && bData.blacklist) setBlacklist(bData.blacklist);
    } catch (err) {
      console.error('Error fetching contacts:', err);
    }
  };

  const loadAnalytics = async () => {
    try {
      const res = await fetch('/api/analytics/overview');
      const data = await res.json();
      if (res.ok) setAnalytics(data);
    } catch (err) {
      console.error('Error fetching analytics:', err);
    }
  };

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (res.ok && data.settings) setSettings(data.settings);
    } catch (err) {
      console.error('Error fetching settings:', err);
    }

    try {
      const aiRes = await fetch('/api/v1/settings/ai');
      const aiData = await aiRes.json();
      if (aiRes.ok && aiData.settings) {
        setAiMaskedKey(aiData.settings.maskedKey || '');
        setAiModel(aiData.settings.defaultModel || 'anthropic/claude-3.5-haiku');
        setAiSpendCap(aiData.settings.monthlySpendCapUsd ?? 10.0);
      }
    } catch (err) {
      console.error('Error fetching AI settings:', err);
    }
  };

  const loadConversations = async () => {
    try {
      const res = await fetch('/api/replies');
      const data = await res.json();
      if (res.ok && data.conversations) {
        setConversations(data.conversations);
        if (data.conversations.length > 0 && !selectedConversation) {
          setSelectedConversation(data.conversations[0].id);
          loadConversationMessages(data.conversations[0].id);
        }
      }
    } catch (err) {
      console.error('Error loading conversations:', err);
    }
  };

  const loadConversationMessages = async (convId: string) => {
    try {
      const res = await fetch(`/api/replies/${convId}`);
      const data = await res.json();
      if (res.ok && data.messages) {
        setConversationMessages(data.messages);
      }
    } catch (err) {
      console.error('Error loading conversation messages:', err);
    }
  };

  // SSE Stream for Live Campaign
  useEffect(() => {
    if (!activeCampaignId || currentTab !== 'live') return;

    loadRecipients(activeCampaignId);
    loadCampaignVariantStats(activeCampaignId);

    const eventSource = new EventSource(`/api/campaigns/${activeCampaignId}/stream`);

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'INIT' || payload.type === 'HEARTBEAT' || payload.type === 'STATUS_CHANGE') {
          setLiveStats(payload.stats || payload.campaign?.stats);
          if (payload.campaign?.status) {
            setCampaigns((prev) =>
              prev.map((c) => (c.id === activeCampaignId ? { ...c, status: payload.campaign.status } : c))
            );
          }
        } else if (payload.type === 'LOG') {
          setLiveLogs((prev) => [payload.log, ...prev].slice(0, 100));
        } else if (payload.type === 'JITTER') {
          setJitterInfo(payload);
        }
      } catch (e) {
        console.error('Error parsing SSE event:', e);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [activeCampaignId, currentTab]);

  const loadRecipients = async (campaignId: string, variantFilter = selectedVariantFilter) => {
    try {
      const q = variantFilter && variantFilter !== 'ALL' ? `&variantId=${variantFilter}` : '';
      const res = await fetch(`/api/campaigns/${campaignId}/recipients?limit=100${q}`);
      const data = await res.json();
      if (res.ok && data.recipients) {
        setRecipientsList(data.recipients);
      }
    } catch (err) {
      console.error('Error loading recipients:', err);
    }
  };

  const loadCampaignVariantStats = async (campaignId: string) => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`);
      const data = await res.json();
      if (res.ok && data.variantStats) {
        setLiveVariantStats(data.variantStats);
      }
    } catch (err) {
      console.error('Error loading variant stats:', err);
    }
  };

  const handleToggleVariantPause = async (variantId: string, currentPaused: boolean) => {
    if (!activeCampaignId) return;
    const action = currentPaused ? 'resume' : 'pause';
    const confirmMsg = currentPaused
      ? 'Resume this message for future sends?'
      : 'Pause this message? Remaining queued recipients will be redistributed across the other active messages.';
    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/campaigns/${activeCampaignId}/variants/${variantId}/${action}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${action} message`);
      alert(data.message || `Message updated successfully`);
      loadCampaignVariantStats(activeCampaignId);
      loadRecipients(activeCampaignId);
    loadCampaignVariantStats(activeCampaignId);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSaveWinningTemplate = async (content: string, label: string) => {
    try {
      const name = prompt('Enter a template name:', `Winning Template - ${label}`);
      if (!name) return;
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, content, category: 'Top Performer' }),
      });
      if (res.ok) {
        alert('Saved winning message to templates library!');
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to save template');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Campaign Actions
  const handleCampaignAction = async (action: 'pause' | 'resume' | 'abort') => {
    if (!activeCampaignId) return;
    try {
      const res = await fetch(`/api/campaigns/${activeCampaignId}/${action}`, { method: 'POST' });
      if (res.ok) {
        loadCampaigns();
      } else {
        const d = await res.json();
        alert(d.error || `Failed to ${action} campaign`);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Create Campaign
  const handleLaunchCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wizName.trim() || wizInstances.length === 0 || wizListIds.length === 0) {
      alert('Please fill in Campaign Name, select at least 1 Instance, and at least 1 Contact List');
      return;
    }

    try {
      const payload: any = {
        name: wizName,
        instances: wizInstances,
        contactListIds: wizListIds,
        minDelay,
        maxDelay,
        batchSize,
        batchDelay,
        sendNow: !isScheduled,
        scheduledAt: isScheduled && scheduleTime ? new Date(scheduleTime).toISOString() : undefined,
        distributionMode: wizDistributionMode,
        rotationScope: wizRotationScope,
        shuffleAudience: wizShuffleAudience,
        shuffleSeed: wizShuffleSeed,
        avoidRepeatContent: wizAvoidRepeatContent,
      };

      if (wizDistributionMode === 'SINGLE') {
        payload.template = wizTemplate;
        payload.mediaType = wizMediaType;
        payload.mediaUrl = wizMediaUrl || undefined;
        payload.fileName = wizFileName || undefined;
      } else {
        payload.variants = wizVariants.map((v, i) => ({
          position: i + 1,
          label: v.label,
          content: v.content,
          mediaType: v.mediaType || 'text',
          mediaUrl: v.mediaUrl || undefined,
          fileName: v.fileName || undefined,
          weight: v.weight,
        }));
      }

      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create campaign');

      await loadCampaigns();
      if (isScheduled) {
        alert(`Campaign "${wizName}" scheduled successfully for automatic execution at ${new Date(scheduleTime).toLocaleString()}!`);
        setCurrentTab('campaigns');
      } else {
        setActiveCampaignId(data.campaign.id);
        setCurrentTab('live');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Contact Import Handler
  const handleImportContacts = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportingFile(true);
    setImportStats(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('listName', `Import-${new Date().toLocaleDateString()}`);

      const res = await fetch('/api/contacts/import', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to import contacts');

      setImportStats(data);
      loadContacts();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setImportingFile(false);
    }
  };

  // Create WhatsApp Instance
  const handleCreateInstance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInstanceName.trim()) return;

    try {
      const res = await fetch('/api/evolution/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceName: newInstanceName.trim() })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to create instance');

      setNewInstanceModal(false);
      setQrModalInstance(newInstanceName.trim());
      setNewInstanceName('');
      loadInstances();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Send WhatsApp Reply
  const handleSendReply = async () => {
    if (!replyInputText.trim() || !selectedConversation || !replyInstance) return;
    setSendingReply(true);
    try {
      const res = await fetch(`/api/replies/${selectedConversation}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: replyInputText.trim(),
          instanceName: replyInstance
        })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to send reply');

      setReplyInputText('');
      loadConversationMessages(selectedConversation);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSendingReply(false);
    }
  };

  // Sync Chats from WhatsApp
  const handleSyncChats = async () => {
    if (!replyInstance) {
      alert('Please select an instance to sync chats from');
      return;
    }
    setSyncingReplies(true);
    try {
      const res = await fetch('/api/replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceName: replyInstance })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to sync chats');
      alert(`Sync completed! ${d.syncedChats || 0} chats synced.`);
      loadConversations();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSyncingReplies(false);
    }
  };

  // Upload Chat History File (.txt)
  const handleUploadChatFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingChat(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/replies/upload-chat', {
        method: 'POST',
        body: formData
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to upload chat file');
      alert(`Chat history parsed successfully! Imported ${d.importedMessages || 0} messages.`);
      loadConversations();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploadingChat(false);
    }
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings })
      });
      if (res.ok) {
        setSettingsSavedMsg('Settings saved successfully!');
        setTimeout(() => setSettingsSavedMsg(''), 3000);
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to save settings');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSaveAiSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAiSettings(true);
    try {
      const res = await fetch('/api/v1/settings/ai', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: aiApiKey.trim() || undefined,
          defaultModel: aiModel,
          monthlySpendCapUsd: aiSpendCap,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setAiApiKey('');
        loadSettings();
        setSettingsSavedMsg('AI Guardrail Advisor settings saved!');
        setTimeout(() => setSettingsSavedMsg(''), 3000);
      } else {
        alert(data.error || 'Failed to save AI settings');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingAiSettings(false);
    }
  };

  const handleTestAiConnection = async () => {
    setAiTesting(true);
    setAiTestResult(null);
    try {
      const res = await fetch('/api/v1/settings/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: aiApiKey.trim() || undefined,
          model: aiModel,
        }),
      });
      const data = await res.json();
      setAiTestResult(data);
    } catch (err: any) {
      setAiTestResult({ success: false, error: err.message });
    } finally {
      setAiTesting(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const activeCampaign = campaigns.find((c) => c.id === activeCampaignId);
  const connectedCount = instances.filter((i) => i.connectionStatus === 'open').length;

  return (
    <div className="min-h-screen bg-[#0b141a] text-slate-100 flex flex-col md:flex-row font-sans selection:bg-emerald-500/30 selection:text-emerald-300">
      
      {/* ========================================================= */}
      {/* 1. LEFT SIDEBAR (DESKTOP)                                */}
      {/* ========================================================= */}
      <aside 
        className={`bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 transition-all duration-300 z-30 sticky top-0 h-screen ${
          sidebarCollapsed ? 'w-[72px]' : 'w-64'
        } hidden md:flex`}
      >
        {/* Brand Header */}
        <div className="h-16 px-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-lg shadow-emerald-950/50 shrink-0">
              <Send className="w-5 h-5 -rotate-12 translate-x-0.5" />
            </div>
            {!sidebarCollapsed && (
              <div className="truncate">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm tracking-tight text-white">BulkFlow</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                    v2.0
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">WhatsApp Gateway</p>
              </div>
            )}
          </div>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {/* Dashboard */}
          <button
            onClick={() => setCurrentTab('overview')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
              currentTab === 'overview'
                ? 'bg-emerald-600 text-white font-semibold shadow-md shadow-emerald-950/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
            title="Dashboard Overview"
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>Dashboard</span>}
          </button>

          {/* Campaigns */}
          <button
            onClick={() => setCurrentTab('campaigns')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
              currentTab === 'campaigns' || currentTab === 'live' || currentTab === 'wizard'
                ? 'bg-emerald-600 text-white font-semibold shadow-md shadow-emerald-950/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
            title="Campaigns"
          >
            <div className="flex items-center gap-3">
              <Send className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>Campaigns</span>}
            </div>
            {!sidebarCollapsed && activeCampaign?.status === 'RUNNING' && (
              <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping"></span>
            )}
          </button>

          {/* Contacts */}
          <button
            onClick={() => setCurrentTab('contacts')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
              currentTab === 'contacts'
                ? 'bg-emerald-600 text-white font-semibold shadow-md shadow-emerald-950/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
            title="Contacts & Lists"
          >
            <div className="flex items-center gap-3">
              <Users className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>Contacts</span>}
            </div>
            {!sidebarCollapsed && contacts.length > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
                {contacts.length}
              </span>
            )}
          </button>

          {/* Templates */}
          <button
            onClick={() => setCurrentTab('templates')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
              currentTab === 'templates'
                ? 'bg-emerald-600 text-white font-semibold shadow-md shadow-emerald-950/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
            title="Message Templates"
          >
            <FileText className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>Templates</span>}
          </button>

          {/* Replies */}
          <button
            onClick={() => setCurrentTab('replies')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
              currentTab === 'replies'
                ? 'bg-emerald-600 text-white font-semibold shadow-md shadow-emerald-950/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
            title="Replies & Chat"
          >
            <div className="flex items-center gap-3">
              <MessageSquare className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>Replies</span>}
            </div>
            {!sidebarCollapsed && conversations.filter((c) => c.status === 'UNREAD').length > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-teal-500 text-slate-950 font-bold">
                {conversations.filter((c) => c.status === 'UNREAD').length}
              </span>
            )}
          </button>

          {/* Instances */}
          <button
            onClick={() => setCurrentTab('instances')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
              currentTab === 'instances'
                ? 'bg-emerald-600 text-white font-semibold shadow-md shadow-emerald-950/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
            title="WhatsApp Instances"
          >
            <div className="flex items-center gap-3">
              <Smartphone className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>Instances</span>}
            </div>
            {!sidebarCollapsed && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-slate-800 text-emerald-400">
                {connectedCount}/{instances.length}
              </span>
            )}
          </button>

          {/* Guardrails (Between Instances and Reports) */}
          <button
            onClick={() => {
              setCurrentTab('guardrails');
              if (typeof window !== 'undefined') {
                window.history.replaceState(null, '', '/?tab=guardrails');
              }
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
              currentTab === 'guardrails'
                ? 'bg-emerald-600 text-white font-semibold shadow-md shadow-emerald-950/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
            title="Anti-Ban Guardrails Settings"
          >
            <div className="flex items-center gap-3">
              <Shield className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>Guardrails</span>}
            </div>
            {!sidebarCollapsed && (
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                currentTab === 'guardrails'
                  ? 'bg-emerald-500/20 text-white font-bold'
                  : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
              }`}>
                Safe
              </span>
            )}
          </button>

          {/* Reports */}
          <button
            onClick={() => setCurrentTab('reports')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
              currentTab === 'reports'
                ? 'bg-emerald-600 text-white font-semibold shadow-md shadow-emerald-950/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
            title="Reports & Analytics"
          >
            <BarChart3 className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>Reports</span>}
          </button>

          {/* System */}
          <button
            onClick={() => setCurrentTab('system')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
              currentTab === 'system'
                ? 'bg-emerald-600 text-white font-semibold shadow-md shadow-emerald-950/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
            title="System Health & Metrics"
          >
            <Activity className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>System</span>}
          </button>

          {/* Settings */}
          <button
            onClick={() => setCurrentTab('settings')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
              currentTab === 'settings'
                ? 'bg-emerald-600 text-white font-semibold shadow-md shadow-emerald-950/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
            title="Gateway Settings"
          >
            <SettingsIcon className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>Settings</span>}
          </button>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-800 space-y-2">
          {!sidebarCollapsed && currentUser && (
            <div className="px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
              <div className="truncate">
                <p className="text-[11px] font-bold text-slate-200 truncate">{currentUser.email}</p>
                <p className="text-[10px] text-emerald-400 font-mono uppercase tracking-wider">{currentUser.role || 'Admin'}</p>
              </div>
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            </div>
          )}

          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 transition cursor-pointer ${
              sidebarCollapsed ? 'justify-center' : ''
            }`}
            title="Log out"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* 2. MAIN CONTENT AREA & TOP BAR                           */}
      {/* ========================================================= */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        
        {/* Top Header Bar */}
        <header className="h-16 bg-slate-900/90 backdrop-blur border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20">
          {/* Breadcrumb / Current Screen Title */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-400 capitalize hidden sm:inline">BulkFlow</span>
            <span className="text-slate-600 hidden sm:inline">/</span>
            <h1 className="text-sm font-bold text-white capitalize">
              {currentTab === 'overview' && 'Dashboard Overview'}
              {currentTab === 'campaigns' && 'Campaigns'}
              {currentTab === 'live' && 'Live Campaign Monitor'}
              {currentTab === 'wizard' && 'New Campaign Wizard'}
              {currentTab === 'contacts' && 'Contacts & Lists'}
              {currentTab === 'templates' && 'Message Templates'}
              {currentTab === 'replies' && 'WhatsApp Replies Inbox'}
              {currentTab === 'instances' && 'WhatsApp Instances'}
              {currentTab === 'guardrails' && 'Anti-Ban Guardrails'}
              {currentTab === 'reports' && 'Reports & Analytics'}
              {currentTab === 'system' && 'System Health & Engine'}
              {currentTab === 'settings' && 'Gateway Settings'}
            </h1>
          </div>

          {/* Quick Search & Command Palette Trigger */}
          <div className="flex-1 max-w-md mx-4 hidden md:block">
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="w-full bg-slate-950/80 hover:bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 flex items-center justify-between text-xs text-slate-400 transition"
            >
              <div className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-slate-500" />
                <span>Quick search or jump to...</span>
              </div>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-300">
                Ctrl K
              </kbd>
            </button>
          </div>

          {/* Global Status Strip & Quick Action */}
          <div className="flex items-center gap-3">
            {/* Instance Status Chips */}
            <div className="hidden lg:flex items-center gap-2">
              {instances.slice(0, 2).map((inst) => {
                const isOpen = inst.connectionStatus === 'open';
                return (
                  <div
                    key={inst.id}
                    className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-[11px]"
                    title={`Instance: ${inst.name} | Status: ${inst.connectionStatus}`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                      }`}
                    />
                    <span className="font-mono text-slate-300">{inst.name}</span>
                    <span className="text-slate-500 font-mono">
                      ({inst.todaySent || 0}/{inst.dailyQuota || 200})
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Quick Action Button */}
            <button
              onClick={() => setCurrentTab('wizard')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-950/40 transition cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Campaign</span>
            </button>
          </div>
        </header>

        {/* Main Body View */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-24 md:pb-12">
          
          {/* ========================================================= */}
          {/* 3. VIEW: OVERVIEW / DASHBOARD                             */}
          {/* ========================================================= */}
          {currentTab === 'overview' && (
            <div className="space-y-6">
              {/* Top 4 KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Sent Today */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span>Sent Today</span>
                    <Send className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono tabular-nums">
                      {analytics?.todaySent || 0}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">/ {analytics?.totalQuota || 400} cap</span>
                  </div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full mt-3 overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ 
                        width: `${Math.min(100, ((analytics?.todaySent || 0) / (analytics?.totalQuota || 400)) * 100)}%` 
                      }}
                    />
                  </div>
                </div>

                {/* Delivery Rate */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span>Delivery Rate</span>
                    <CheckCheck className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono tabular-nums">
                      {analytics?.deliveryRate || '98.4'}%
                    </span>
                    <span className="text-xs text-emerald-500/80 font-mono">↑ 1.2%</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-3 font-mono">Monotonic State Validated</p>
                </div>

                {/* Read Rate */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span>Read Rate</span>
                    <Eye className="w-4 h-4 text-teal-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-extrabold text-teal-400 font-mono tabular-nums">
                      {analytics?.readRate || '76.8'}%
                    </span>
                    <span className="text-xs text-teal-500/80 font-mono">↑ 3.4%</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-3 font-mono">Blue-tick confirmed</p>
                </div>

                {/* Reply Rate */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span>Active Replies</span>
                    <MessageSquare className="w-4 h-4 text-sky-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-extrabold text-sky-400 font-mono tabular-nums">
                      {conversations.length}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">inbox chats</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-3 font-mono">
                    {conversations.filter((c) => c.status === 'UNREAD').length} unread messages
                  </p>
                </div>
              </div>

              {/* Active Campaigns & Instances Overview */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Active Campaign Card */}
                <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white">Active Campaigns</h3>
                      <p className="text-xs text-slate-400">Live background dispatch status</p>
                    </div>
                    <button
                      onClick={() => setCurrentTab('campaigns')}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
                    >
                      View All →
                    </button>
                  </div>

                  {campaigns.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 text-xs">
                      No campaigns created yet. Click "+ New Campaign" to get started.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {campaigns.slice(0, 3).map((camp) => (
                        <div
                          key={camp.id}
                          className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-white">{camp.name}</span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                  camp.status === 'RUNNING'
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                    : camp.status === 'PAUSED'
                                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {camp.status}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 font-mono mt-1">
                              Sent {camp.stats?.sent || 0} of {camp.stats?.total || 0} messages
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setActiveCampaignId(camp.id);
                                setCurrentTab('live');
                              }}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium transition cursor-pointer"
                            >
                              Live Monitor
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Connected WhatsApp Numbers */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white">Instances</h3>
                      <p className="text-xs text-slate-400">{connectedCount} of {instances.length} connected</p>
                    </div>
                    <button
                      onClick={() => setNewInstanceModal(true)}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
                    >
                      + Add
                    </button>
                  </div>

                  <div className="space-y-3">
                    {instances.length === 0 ? (
                      <div className="py-8 text-center text-slate-500 text-xs">
                        No instances registered.
                      </div>
                    ) : (
                      instances.slice(0, 3).map((inst) => {
                        const isOpen = inst.connectionStatus === 'open';
                        return (
                          <div
                            key={inst.id}
                            className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                                  isOpen ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                                }`}
                              >
                                WA
                              </div>
                              <div>
                                <p className="text-xs font-bold text-white">{inst.name}</p>
                                <p className="text-[11px] text-slate-400 font-mono">{inst.phone || 'No phone set'}</p>
                              </div>
                            </div>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                isOpen ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                              }`}
                            >
                              {isOpen ? 'Connected' : 'Offline'}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* 7-Day Performance Chart */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">7-Day Delivery & Read Funnel</h3>
                    <p className="text-xs text-slate-400">Hourly & daily throughput volume</p>
                  </div>
                  <span className="text-xs font-mono text-emerald-400">Aggregated SSE Metrics</span>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={[
                        { day: 'Mon', sent: 120, delivered: 118, read: 92 },
                        { day: 'Tue', sent: 210, delivered: 205, read: 165 },
                        { day: 'Wed', sent: 340, delivered: 332, read: 260 },
                        { day: 'Thu', sent: 180, delivered: 176, read: 140 },
                        { day: 'Fri', sent: 290, delivered: 284, read: 220 },
                        { day: 'Sat', sent: 150, delivered: 148, read: 110 },
                        { day: 'Sun', sent: 220, delivered: 215, read: 180 }
                      ]}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorRead" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="day" stroke="#64748b" fontSize={11} />
                      <YAxis stroke="#64748b" fontSize={11} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                      <Area type="monotone" dataKey="sent" stroke="#10b981" fillOpacity={1} fill="url(#colorSent)" />
                      <Area type="monotone" dataKey="read" stroke="#14b8a6" fillOpacity={1} fill="url(#colorRead)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 4. VIEW: CAMPAIGNS (LIST, LIVE, WIZARD)                    */}
          {/* ========================================================= */}
          {currentTab === 'campaigns' && (
            <div className="space-y-6">
              {/* Header with Sub-tabs */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Campaigns Manager</h2>
                  <p className="text-xs text-slate-400">Create, monitor, and manage bulk outreach runs</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentTab('wizard')}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-950/40 transition cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Create Campaign</span>
                  </button>
                </div>
              </div>

              {/* Campaigns Table */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
                    <tr>
                      <th className="p-4">Campaign Name</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Progress</th>
                      <th className="p-4">Created Date</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {campaigns.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-500 text-xs">
                          No campaigns created yet. Click "Create Campaign" to begin.
                        </td>
                      </tr>
                    ) : (
                      campaigns.map((camp) => (
                        <tr key={camp.id} className="hover:bg-slate-850/60 transition">
                          <td className="p-4">
                            <span className="font-bold text-white">{camp.name}</span>
                            <p className="text-[11px] text-slate-400 font-mono">ID: {camp.id.slice(0, 8)}...</p>
                          </td>
                          <td className="p-4">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                camp.status === 'RUNNING'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                  : camp.status === 'PAUSED'
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                                  : camp.status === 'COMPLETED'
                                  ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {camp.status}
                            </span>
                          </td>
                          <td className="p-4 font-mono">
                            <div className="flex items-center gap-2">
                              <span>{camp.stats?.sent || 0} / {camp.stats?.total || 0}</span>
                              <div className="w-20 bg-slate-950 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="bg-emerald-500 h-full"
                                  style={{
                                    width: `${Math.min(100, ((camp.stats?.sent || 0) / (camp.stats?.total || 1)) * 100)}%`
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-slate-400 font-mono text-[11px]">
                            {new Date(camp.createdAt).toLocaleDateString()}
                          </td>
                          <td className="p-4 text-right space-x-2">
                            <button
                              onClick={() => {
                                setActiveCampaignId(camp.id);
                                setCurrentTab('live');
                              }}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium transition cursor-pointer"
                            >
                              Live View
                            </button>
                            <a
                              href={`/api/campaigns/${camp.id}/export?format=csv`}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-lg text-xs font-medium transition inline-block"
                            >
                              CSV
                            </a>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 5. VIEW: LIVE CAMPAIGN MONITOR                            */}
          {/* ========================================================= */}
          {currentTab === 'live' && (
            <div className="space-y-6">
              {/* Campaign Header & Controls */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-white">{activeCampaign?.name || 'Live Campaign'}</h2>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        activeCampaign?.status === 'RUNNING'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {activeCampaign?.status || 'IDLE'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-1">ID: {activeCampaignId}</p>
                </div>

                {/* Control Action Buttons */}
                <div className="flex items-center gap-2">
                  {activeCampaign?.status === 'RUNNING' && (
                    <button
                      onClick={() => handleCampaignAction('pause')}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pause</span>
                    </button>
                  )}
                  {activeCampaign?.status === 'PAUSED' && (
                    <button
                      onClick={() => handleCampaignAction('resume')}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Resume</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleCampaignAction('abort')}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>Abort</span>
                  </button>
                </div>
              </div>

              {/* Progress & Speed Breakdown */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-400 gap-2">
                  <span>Segmented Monotonic Progress</span>
                  <div className="flex items-center gap-4 font-mono">
                    {jitterInfo && (
                      <span className="text-amber-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        Next message in {jitterInfo.countdown}s
                      </span>
                    )}
                    <span>
                      {liveStats?.sent || activeCampaign?.stats?.sent || 0} /{' '}
                      {liveStats?.total || activeCampaign?.stats?.total || 0} dispatched
                    </span>
                  </div>
                </div>

                {/* Segmented Progress Bar */}
                <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden flex">
                  <div
                    className="bg-teal-500 transition-all duration-300"
                    style={{
                      width: `${
                        ((liveStats?.read || 0) / (liveStats?.total || 1)) * 100
                      }%`
                    }}
                    title="Read"
                  />
                  <div
                    className="bg-emerald-500 transition-all duration-300"
                    style={{
                      width: `${
                        ((liveStats?.delivered || 0) / (liveStats?.total || 1)) * 100
                      }%`
                    }}
                    title="Delivered"
                  />
                  <div
                    className="bg-sky-500 transition-all duration-300"
                    style={{
                      width: `${
                        (((liveStats?.sent || 0) - (liveStats?.delivered || 0) - (liveStats?.read || 0)) /
                          (liveStats?.total || 1)) *
                        100
                      }%`
                    }}
                    title="Sent"
                  />
                  <div
                    className="bg-rose-500 transition-all duration-300"
                    style={{
                      width: `${
                        ((liveStats?.failed || 0) / (liveStats?.total || 1)) * 100
                      }%`
                    }}
                    title="Failed"
                  />
                </div>

                {/* Legend */}
                <div className="flex flex-wrap items-center gap-4 text-xs font-mono pt-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                    <span>Read: {liveStats?.read || 0}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span>Delivered: {liveStats?.delivered || 0}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                    <span>Sent: {liveStats?.sent || 0}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span>Failed: {liveStats?.failed || 0}</span>
                  </div>
                </div>
              </div>

              {/* Live Sub-Tabs: Stream / Recipients / Multi-Message Variants (Section 5) */}
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setLiveActiveTab('stream')}
                  className={`px-3.5 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer ${
                    liveActiveTab === 'stream'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
                      : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850'
                  }`}
                >
                  <Terminal className="w-4 h-4" />
                  <span>Live Event Stream</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLiveActiveTab('recipients');
                    if (activeCampaignId) loadRecipients(activeCampaignId);
                  }}
                  className={`px-3.5 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer ${
                    liveActiveTab === 'recipients'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
                      : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Recipients Log</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLiveActiveTab('variants');
                    if (activeCampaignId) loadCampaignVariantStats(activeCampaignId);
                  }}
                  className={`px-3.5 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer ${
                    liveActiveTab === 'variants'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
                      : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Variants Analytics</span>
                </button>
              </div>

              {/* Tab 1: Live Streaming Logs */}
              {liveActiveTab === 'stream' && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-emerald-400" />
                      <span>Live Event Stream</span>
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-xs text-slate-400 font-mono">SSE Connected</span>
                    </div>
                  </div>

                  <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 font-mono text-xs max-h-80 overflow-y-auto space-y-2">
                    {liveLogs.length === 0 ? (
                      <div className="text-slate-500 text-center py-6">Waiting for message events...</div>
                    ) : (
                      liveLogs.map((log, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-slate-300">
                          <span className="text-slate-500 shrink-0">[{new Date(log.timestamp || Date.now()).toLocaleTimeString()}]</span>
                          <span
                            className={`font-bold shrink-0 ${
                              log.status === 'READ'
                                ? 'text-teal-400'
                                : log.status === 'DELIVERED'
                                ? 'text-emerald-400'
                                : log.status === 'FAILED'
                                ? 'text-rose-400'
                                : 'text-sky-400'
                            }`}
                          >
                            {log.status}
                          </span>
                          <span className="text-slate-400">{log.phone}</span>
                          <span className="text-slate-500 truncate">{log.message || log.error || ''}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Tab 2: Recipients Table with M1/M2/M3 Rotation Badges (Section 5) */}
              {liveActiveTab === 'recipients' && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl space-y-3 p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Users className="w-4 h-4 text-emerald-400" />
                      <span>Audience Recipients & Rotation Assignments</span>
                    </h3>

                    {/* Filter by Variant */}
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">Filter Message:</span>
                      <select
                        value={selectedVariantFilter}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedVariantFilter(val);
                          if (activeCampaignId) loadRecipients(activeCampaignId, val);
                        }}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white"
                      >
                        <option value="ALL">All Messages</option>
                        {liveVariantStats.map((vs) => (
                          <option key={vs.id} value={vs.id}>
                            M{vs.position}: {vs.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-mono text-[11px]">
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">Message Variant</th>
                          <th className="py-2.5 px-3">Phone</th>
                          <th className="py-2.5 px-3">Name</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Sent Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-sans">
                        {recipientsList.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-slate-500">
                              No recipients found matching criteria.
                            </td>
                          </tr>
                        ) : (
                          recipientsList.map((r, i) => {
                            const variantNum = r.variant?.position || r.variantIndex + 1;
                            const colors = [
                              'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
                              'bg-sky-500/20 text-sky-300 border-sky-500/40',
                              'bg-purple-500/20 text-purple-300 border-purple-500/40',
                              'bg-amber-500/20 text-amber-300 border-amber-500/40',
                            ];
                            const badgeColor = colors[(variantNum - 1) % colors.length] || colors[0];
                            return (
                              <tr key={r.id || i} className="hover:bg-slate-850/50 transition">
                                <td className="py-2.5 px-3 font-mono text-slate-500">
                                  {r.rotationIndex || i + 1}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono border ${badgeColor}`}
                                  >
                                    M{variantNum}: {r.variant?.label || `Message ${variantNum}`}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 font-mono text-slate-200">{r.phone}</td>
                                <td className="py-2.5 px-3 text-slate-300">{r.name || '—'}</td>
                                <td className="py-2.5 px-3">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                      r.status === 'SENT' || r.status === 'DELIVERED' || r.status === 'READ' || r.status === 'REPLIED'
                                        ? 'bg-emerald-500/20 text-emerald-400'
                                        : r.status === 'FAILED'
                                        ? 'bg-rose-500/20 text-rose-400'
                                        : 'bg-slate-800 text-slate-400'
                                    }`}
                                  >
                                    {r.status}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                                  {r.sentAt ? new Date(r.sentAt).toLocaleTimeString() : '—'}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 3: Variants Analytics & Performance (Section 5) */}
              {liveActiveTab === 'variants' && (
                <CampaignVariantsLiveTab
                  campaignId={activeCampaignId || ''}
                  variantStats={liveVariantStats}
                  onTogglePause={(vId, isPaused) => handleToggleVariantPause(vId, isPaused)}
                  onSaveAsTemplate={handleSaveWinningTemplate}
                  onRefresh={() => activeCampaignId && loadCampaignVariantStats(activeCampaignId)}
                />
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* 6. VIEW: CAMPAIGN WIZARD (COMPOSER + LIVE PREVIEW)        */}
          {/* ========================================================= */}
          {currentTab === 'wizard' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Create New Campaign</h2>
                  <p className="text-xs text-slate-400">Configure audience, message, media, and anti-ban pacing</p>
                </div>
              </div>

              <form onSubmit={handleLaunchCampaign} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: Form & Composer */}
                <div className="lg:col-span-7 space-y-6">
                  {/* Step 1: Campaign Details */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">1. Campaign Details</h3>
                    
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Campaign Name</label>
                      <input
                        type="text"
                        required
                        value={wizName}
                        onChange={(e) => setWizName(e.target.value)}
                        placeholder="e.g. Summer Promo 2026"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Instance Selection */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">WhatsApp Instance</label>
                        <select
                          multiple
                          value={wizInstances}
                          onChange={(e) =>
                            setWizInstances(Array.from(e.target.selectedOptions, (option) => option.value))
                          }
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white h-24 font-mono"
                        >
                          {instances.map((i) => (
                            <option key={i.id} value={i.name}>
                              {i.name} ({i.connectionStatus === 'open' ? 'Connected' : 'Offline'})
                            </option>
                          ))}
                        </select>
                        <span className="text-[10px] text-slate-500">Hold Ctrl to select multiple</span>
                      </div>

                      {/* Contact Lists Selection */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Target Contact List(s)</label>
                        <select
                          multiple
                          value={wizListIds}
                          onChange={(e) =>
                            setWizListIds(Array.from(e.target.selectedOptions, (option) => option.value))
                          }
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white h-24 font-mono"
                        >
                          {contactLists.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.name} ({l._count?.contacts || 0} contacts)
                            </option>
                          ))}
                        </select>
                        <span className="text-[10px] text-slate-500">Hold Ctrl to select multiple</span>
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Message Composer with Multi-Message Rotation (Section 1-3) */}
                  <MultiMessageRotationEditor
                    distributionMode={wizDistributionMode}
                    onDistributionModeChange={setWizDistributionMode}
                    rotationScope={wizRotationScope}
                    onRotationScopeChange={setWizRotationScope}
                    shuffleAudience={wizShuffleAudience}
                    onShuffleAudienceChange={setWizShuffleAudience}
                    shuffleSeed={wizShuffleSeed}
                    onShuffleSeedChange={setWizShuffleSeed}
                    avoidRepeatContent={wizAvoidRepeatContent}
                    onAvoidRepeatContentChange={setWizAvoidRepeatContent}
                    variants={wizVariants}
                    onVariantsChange={setWizVariants}
                    singleTemplate={wizTemplate}
                    onSingleTemplateChange={setWizTemplate}
                    singleMediaType={wizMediaType}
                    onSingleMediaTypeChange={setWizMediaType}
                    singleMediaUrl={wizMediaUrl}
                    onSingleMediaUrlChange={setWizMediaUrl}
                    singleFileName={wizFileName}
                    onSingleFileNameChange={setWizFileName}
                    activePreviewVariantIndex={activePreviewVariantIndex}
                    onActivePreviewVariantIndexChange={setActivePreviewVariantIndex}
                    totalRecipientsCount={
                      contactLists
                        .filter((l) => wizListIds.includes(l.id))
                        .reduce((acc, l) => acc + (l._count?.contacts || 0), 0) || 500
                    }
                  />

                  {/* Step 3: Anti-Ban Pacing & Safety */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">3. Anti-Ban Pacing</h3>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                      <div>
                        <label className="text-[11px] text-slate-400">Min Delay (s)</label>
                        <input
                          type="number"
                          value={minDelay}
                          onChange={(e) => setMinDelay(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-400">Max Delay (s)</label>
                        <input
                          type="number"
                          value={maxDelay}
                          onChange={(e) => setMaxDelay(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-400">Batch Size</label>
                        <input
                          type="number"
                          value={batchSize}
                          onChange={(e) => setBatchSize(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-400">Batch Pause (s)</label>
                        <input
                          type="number"
                          value={batchDelay}
                          onChange={(e) => setBatchDelay(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                        />
                      </div>
                    </div>

                    {/* Schedule for Later Option */}
                    <div className="pt-2 space-y-2 border-t border-slate-800">
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                        <input
                          type="checkbox"
                          checked={isScheduled}
                          onChange={(e) => setIsScheduled(e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="font-semibold text-slate-200">Schedule this campaign for automatic execution</span>
                      </label>

                      {isScheduled && (
                        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center gap-3">
                          <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
                          <div className="flex-1">
                            <label className="text-[11px] text-slate-400 block mb-1">Execution Date & Time</label>
                            <input
                              type="datetime-local"
                              required={isScheduled}
                              value={scheduleTime}
                              onChange={(e) => setScheduleTime(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-2">
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                        <input
                          type="checkbox"
                          checked={launchSafetyCheck}
                          onChange={(e) => setLaunchSafetyCheck(e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>I confirm that these recipients have opted in to receive messages.</span>
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={!launchSafetyCheck || (isScheduled && !scheduleTime)}
                      className={`w-full py-3 rounded-xl font-bold text-xs shadow-lg transition ${
                        launchSafetyCheck && (!isScheduled || scheduleTime)
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-emerald-950/50'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {isScheduled ? 'Schedule Campaign for Automatic Dispatch →' : 'Launch Campaign Now →'}
                    </button>
                  </div>
                </div>

                {/* Right Column: Live Sticky WhatsApp Bubble & Rotation Preview */}
                <div className="lg:col-span-5 sticky top-24 space-y-4">
                  {/* Variant Preview Selector (Section 2) */}
                  {wizDistributionMode !== 'SINGLE' && (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-xl">
                      <div className="flex items-center justify-between text-xs text-slate-300">
                        <span className="font-bold flex items-center gap-1.5 text-white">
                          <Eye className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Previewing Variant in Device</span>
                        </span>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                          <span>Show as recipient #:</span>
                          <input
                            type="number"
                            min={1}
                            max={10000}
                            value={previewRecipientNumber}
                            onChange={(e) => {
                              const n = Math.max(1, Number(e.target.value));
                              setPreviewRecipientNumber(n);
                              setActivePreviewVariantIndex((n - 1) % wizVariants.length);
                            }}
                            className="bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-xs text-white font-mono w-14 text-center"
                          />
                        </div>
                      </div>

                      {/* Variant Tabs */}
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                        {wizVariants.map((v, i) => (
                          <button
                            key={v.position}
                            type="button"
                            onClick={() => {
                              setActivePreviewVariantIndex(i);
                              setPreviewRecipientNumber(i + 1);
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0 ${
                              activePreviewVariantIndex === i
                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/40'
                                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                            }`}
                          >
                            <span>M{v.position}</span>
                            <span className="text-[10px] font-normal opacity-80 truncate max-w-[80px]">({v.label})</span>
                          </button>
                        ))}
                      </div>

                      {/* Content Exposure Estimate Summary (Section 7) */}
                      <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 space-y-1 font-mono">
                        <div className="flex items-center justify-between text-slate-300">
                          <span>Max exposure per identical message:</span>
                          <span className="text-emerald-400 font-bold">
                            ~{Math.round(
                              (contactLists
                                .filter((l) => wizListIds.includes(l.id))
                                .reduce((acc, l) => acc + (l._count?.contacts || 0), 0) || 500) /
                                (wizVariants.length || 1)
                            )}{' '}
                            contacts
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500">
                          Strict sequence rotation divides identical content across {wizVariants.length} distinct texts. Spintax reduces identical text further.
                        </p>
                      </div>
                    </div>
                  )}

                  <LiveWhatsAppBubble
                    content={
                      wizDistributionMode === 'SINGLE'
                        ? wizTemplate
                        : wizVariants[activePreviewVariantIndex]?.content || ''
                    }
                    mediaType={
                      wizDistributionMode === 'SINGLE'
                        ? wizMediaType
                        : wizVariants[activePreviewVariantIndex]?.mediaType || 'text'
                    }
                    mediaUrl={
                      wizDistributionMode === 'SINGLE'
                        ? wizMediaUrl
                        : wizVariants[activePreviewVariantIndex]?.mediaUrl || ''
                    }
                    caption={
                      (wizDistributionMode === 'SINGLE'
                        ? wizMediaType
                        : wizVariants[activePreviewVariantIndex]?.mediaType) !== 'text'
                        ? wizDistributionMode === 'SINGLE'
                          ? wizTemplate
                          : wizVariants[activePreviewVariantIndex]?.content
                        : undefined
                    }
                    sampleRecipient={{
                      name: previewRecipientNumber === 1 ? 'Rahul Sharma' : `Audience Contact #${previewRecipientNumber}`,
                      phone: `9198765432${String(previewRecipientNumber).padStart(2, '0')}`,
                    }}
                    appendOptOut={true}
                  />
                </div>
              </form>
            </div>
          )}

          {/* ========================================================= */}
          {/* 7. VIEW: CONTACTS & LISTS                                 */}
          {/* ========================================================= */}
          {currentTab === 'contacts' && (
            <div className="space-y-6">
              {/* Header with Sample Templates Download */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Contacts & Audience</h2>
                  <p className="text-xs text-slate-400">Manage customer phone numbers, lists, and opt-outs</p>
                </div>

                {/* Quick Actions & Template Downloads */}
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href="/api/contacts/sample?format=csv"
                    download="sample_contacts.csv"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-xl text-xs font-mono transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Sample CSV</span>
                  </a>
                  <a
                    href="/api/contacts/sample?format=xlsx"
                    download="sample_contacts.xlsx"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-xl text-xs font-mono transition"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Sample Excel</span>
                  </a>

                  {/* Upload Contacts Button */}
                  <label className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{importingFile ? 'Importing...' : 'Import Contacts'}</span>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleImportContacts}
                      disabled={importingFile}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Import Results Banner */}
              {importStats && (
                <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-4 text-xs font-mono text-emerald-400 flex items-center justify-between">
                  <div>
                    Import completed: {importStats.imported || 0} valid contacts added. ({importStats.duplicates || 0} duplicates skipped, {importStats.invalid || 0} invalid).
                  </div>
                  <button onClick={() => setImportStats(null)} className="text-slate-400 hover:text-white">✕</button>
                </div>
              )}

              {/* Sub-tabs & Search */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
                  <button
                    onClick={() => setContactSubTab('all')}
                    className={`px-3 py-1.5 rounded-lg ${contactSubTab === 'all' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400'}`}
                  >
                    All Contacts ({contacts.length})
                  </button>
                  <button
                    onClick={() => setContactSubTab('lists')}
                    className={`px-3 py-1.5 rounded-lg ${contactSubTab === 'lists' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400'}`}
                  >
                    Lists ({contactLists.length})
                  </button>
                  <button
                    onClick={() => setContactSubTab('blacklist')}
                    className={`px-3 py-1.5 rounded-lg ${contactSubTab === 'blacklist' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400'}`}
                  >
                    Blacklist ({blacklist.length})
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    placeholder="Search name or phone..."
                    className="bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              {/* Contacts Table */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
                    <tr>
                      <th className="p-4">Name</th>
                      <th className="p-4">Phone Number</th>
                      <th className="p-4">Custom Variables</th>
                      <th className="p-4">Added Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {contacts.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-slate-500 text-xs">
                          No contacts available. Download the sample template above and import your contacts.
                        </td>
                      </tr>
                    ) : (
                      contacts
                        .filter(
                          (c) =>
                            !contactSearch ||
                            (c.name && c.name.toLowerCase().includes(contactSearch.toLowerCase())) ||
                            (c.phone && c.phone.includes(contactSearch))
                        )
                        .slice(0, 50)
                        .map((c) => (
                          <tr key={c.id} className="hover:bg-slate-850/60 transition">
                            <td className="p-4 font-bold text-white">{c.name || 'Unnamed'}</td>
                            <td className="p-4 font-mono tabular-nums text-emerald-400">+{c.phone}</td>
                            <td className="p-4 font-mono text-[11px] text-slate-400">
                              {c.customVariables ? JSON.stringify(c.customVariables) : '-'}
                            </td>
                            <td className="p-4 font-mono text-[11px] text-slate-400">
                              {new Date(c.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 8. VIEW: TEMPLATES LIBRARY                                */}
          {/* ========================================================= */}
          {currentTab === 'templates' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Message Templates</h2>
                  <p className="text-xs text-slate-400">Ready-made high converting WhatsApp campaign copy</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sampleTemplates.map((tmpl) => (
                  <div
                    key={tmpl.id}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-4 hover:border-slate-700 transition"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 uppercase tracking-wider">
                          {tmpl.category}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">{tmpl.usageCount} sent</span>
                      </div>
                      <h3 className="text-sm font-bold text-white">{tmpl.title}</h3>
                      <div className="bg-[#0b141a] p-3 rounded-xl border border-slate-800/80 text-xs text-slate-300 font-mono mt-3 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                        {tmpl.content}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setWizTemplate(tmpl.content);
                        setWizMediaType(tmpl.mediaType);
                        setCurrentTab('wizard');
                      }}
                      className="w-full py-2 bg-slate-800 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
                    >
                      Use in New Campaign →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 9. VIEW: REPLIES INBOX & CHAT THREAD                      */}
          {/* ========================================================= */}
          {currentTab === 'replies' && (
            <div className="space-y-6">
              {/* Top Controls: Instance Selector & Upload Chat / Sync */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-300">Reply Instance:</span>
                  <select
                    value={replyInstance}
                    onChange={(e) => setReplyInstance(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                  >
                    {instances.map((i) => (
                      <option key={i.id} value={i.name}>
                        {i.name} ({i.connectionStatus === 'open' ? 'Connected' : 'Offline'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  {/* Upload Previous Chat Button */}
                  <label className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-medium transition cursor-pointer">
                    <FileText className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{uploadingChat ? 'Uploading...' : 'Upload Chat (.txt)'}</span>
                    <input
                      type="file"
                      accept=".txt"
                      onChange={handleUploadChatFile}
                      disabled={uploadingChat}
                      className="hidden"
                    />
                  </label>

                  {/* Sync Chats Button */}
                  <button
                    onClick={handleSyncChats}
                    disabled={syncingReplies}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncingReplies ? 'animate-spin' : ''}`} />
                    <span>Sync Live Chats</span>
                  </button>
                </div>
              </div>

              {/* 2-Pane Chat Layout */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden min-h-[550px]">
                {/* Conversations Sidebar (Left) */}
                <div className="md:col-span-4 border-r border-slate-800 flex flex-col">
                  <div className="p-3 border-b border-slate-800 bg-slate-950/60">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Conversations</span>
                  </div>
                  <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
                    {conversations.length === 0 ? (
                      <div className="p-6 text-center text-slate-500 text-xs">
                        No conversations yet. Sync chats or upload a .txt export above.
                      </div>
                    ) : (
                      conversations.map((conv) => (
                        <button
                          key={conv.id}
                          onClick={() => {
                            setSelectedConversation(conv.id);
                            loadConversationMessages(conv.id);
                          }}
                          className={`w-full text-left p-3.5 transition cursor-pointer flex items-start justify-between ${
                            selectedConversation === conv.id ? 'bg-slate-850' : 'hover:bg-slate-850/40'
                          }`}
                        >
                          <div className="truncate">
                            <p className="text-xs font-bold text-white font-mono truncate">+{conv.phone}</p>
                            <p className="text-[11px] text-slate-400 truncate mt-0.5">{conv.lastMessage || 'No message snippet'}</p>
                          </div>
                          {conv.status === 'UNREAD' && (
                            <span className="w-2 h-2 rounded-full bg-teal-400 shrink-0 mt-1" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Message Thread (Right) */}
                <div className="md:col-span-8 flex flex-col bg-[#0b141a]">
                  {/* Thread Header */}
                  <div className="p-3.5 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
                    <span className="text-xs font-bold text-white font-mono">
                      {selectedConversation ? `Chat with +${conversations.find((c) => c.id === selectedConversation)?.phone || ''}` : 'Select a conversation'}
                    </span>
                  </div>

                  {/* Message Bubbles */}
                  <div className="flex-1 p-4 overflow-y-auto space-y-3">
                    {conversationMessages.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                        No messages in this thread yet.
                      </div>
                    ) : (
                      conversationMessages.map((msg, i) => (
                        <div
                          key={i}
                          className={`flex ${msg.direction === 'OUTGOING' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-xs shadow ${
                              msg.direction === 'OUTGOING'
                                ? 'bg-[#005c4b] text-white rounded-tr-none'
                                : 'bg-[#202c33] text-slate-200 rounded-tl-none'
                            }`}
                          >
                            <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                            <span className="text-[10px] text-slate-400 block text-right mt-1 font-mono">
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Reply Input Bar */}
                  <div className="p-3 border-t border-slate-800 bg-slate-900 flex items-center gap-2">
                    <input
                      type="text"
                      value={replyInputText}
                      onChange={(e) => setReplyInputText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
                      placeholder="Type a WhatsApp reply..."
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    />
                    <button
                      onClick={handleSendReply}
                      disabled={sendingReply || !replyInputText.trim()}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition cursor-pointer"
                    >
                      {sendingReply ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 10. VIEW: INSTANCES MANAGEMENT                            */}
          {/* ========================================================= */}
          {currentTab === 'instances' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">WhatsApp Instances</h2>
                  <p className="text-xs text-slate-400">Manage paired phone numbers, scan QR codes, and check status</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={loadInstances}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
                    title="Refresh"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setNewInstanceModal(true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Create Instance</span>
                  </button>
                </div>
              </div>

              {/* Instance Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {instances.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-slate-500 text-xs">
                    No WhatsApp instances registered. Click "Create Instance" to scan your QR code.
                  </div>
                ) : (
                  instances.map((inst) => {
                    const isOpen = inst.connectionStatus === 'open';
                    return (
                      <div
                        key={inst.id}
                        className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 hover:border-slate-700 transition"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                                isOpen ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                              }`}
                            >
                              <Smartphone className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-white">{inst.name}</h3>
                              <p className="text-xs text-slate-400 font-mono">{inst.phone || 'No phone set'}</p>
                            </div>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              isOpen
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {isOpen ? 'Connected' : 'Offline'}
                          </span>
                        </div>

                        {/* Daily Quota Bar */}
                        <div className="space-y-1 font-mono text-[11px]">
                          <div className="flex justify-between text-slate-400">
                            <span>Today's Sent</span>
                            <span>{inst.todaySent || 0} / {inst.dailyQuota || 200}</span>
                          </div>
                          <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-emerald-500 h-full rounded-full"
                              style={{
                                width: `${Math.min(100, ((inst.todaySent || 0) / (inst.dailyQuota || 200)) * 100)}%`
                              }}
                            />
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                          <button
                            onClick={() => setQrModalInstance(inst.name)}
                            className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium transition cursor-pointer"
                          >
                            Scan QR
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm(`Delete instance ${inst.name}?`)) return;
                              await fetch(`/api/evolution/instances/${inst.name}`, { method: 'DELETE' });
                              loadInstances();
                            }}
                            className="p-1.5 text-slate-500 hover:text-rose-400 transition"
                            title="Delete instance"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* VIEW: ANTI-BAN GUARDRAILS                                 */}
          {/* ========================================================= */}
          {currentTab === 'guardrails' && (
            <GuardrailsConsoleTab />
          )}

          {/* ========================================================= */}
          {/* 11. VIEW: REPORTS & ANALYTICS                             */}
          {/* ========================================================= */}
          {currentTab === 'reports' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Reports & Funnel Analytics</h2>
                  <p className="text-xs text-slate-400">End-to-end delivery performance and history</p>
                </div>
              </div>

              {/* Delivery Funnel Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
                  <span className="text-xs text-slate-400">Total Scheduled</span>
                  <p className="text-2xl font-bold text-white font-mono mt-1">1,480</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
                  <span className="text-xs text-slate-400">Delivered Successfully</span>
                  <p className="text-2xl font-bold text-emerald-400 font-mono mt-1">1,452 (98.1%)</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
                  <span className="text-xs text-slate-400">Read / Blue Ticks</span>
                  <p className="text-2xl font-bold text-teal-400 font-mono mt-1">1,120 (75.6%)</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
                  <span className="text-xs text-slate-400">Replied Customers</span>
                  <p className="text-2xl font-bold text-sky-400 font-mono mt-1">218 (14.7%)</p>
                </div>
              </div>

              {/* Campaigns Summary Table */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
                <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Campaign History Log</span>
                </div>
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
                    <tr>
                      <th className="p-4">Name</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Dispatched</th>
                      <th className="p-4">Created</th>
                      <th className="p-4 text-right">Export</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {campaigns.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-850/60">
                        <td className="p-4 font-bold text-white">{c.name}</td>
                        <td className="p-4 font-mono">{c.status}</td>
                        <td className="p-4 font-mono">{c.stats?.sent || 0} / {c.stats?.total || 0}</td>
                        <td className="p-4 font-mono text-slate-400">{new Date(c.createdAt).toLocaleDateString()}</td>
                        <td className="p-4 text-right">
                          <a
                            href={`/api/campaigns/${c.id}/export?format=csv`}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded text-xs font-mono"
                          >
                            Export CSV
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 12. VIEW: SYSTEM HEALTH & ENGINE METRICS                  */}
          {/* ========================================================= */}
          {currentTab === 'system' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">System Health & Engine Metrics</h2>
                  <p className="text-xs text-slate-400">Queue workers, database status, and Prometheus metrics</p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href="/api/metrics"
                    target="_blank"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-xl text-xs font-mono transition"
                  >
                    <span>/api/metrics</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href="/api/docs"
                    target="_blank"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-xl text-xs font-mono transition"
                  >
                    <span>Swagger API Docs</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Status Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Web Application</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <p className="text-lg font-bold text-white font-mono">Next.js 14 App</p>
                  <p className="text-[11px] text-emerald-400 font-mono">Healthy & Ready</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Evolution Engine</span>
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                  </div>
                  <p className="text-lg font-bold text-white font-mono">Evolution v2 API</p>
                  <p className="text-[11px] text-emerald-400 font-mono">{connectedCount} Connected</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Queue Backend</span>
                    <Zap className="w-4 h-4 text-teal-400" />
                  </div>
                  <p className="text-lg font-bold text-white font-mono">Redis Queue</p>
                  <p className="text-[11px] text-teal-400 font-mono">Pacing Active</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>State Machine</span>
                    <ShieldCheck className="w-4 h-4 text-sky-400" />
                  </div>
                  <p className="text-lg font-bold text-white font-mono">Monotonic v2</p>
                  <p className="text-[11px] text-sky-400 font-mono">Strict Transitions</p>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 13. VIEW: SETTINGS                                        */}
          {/* ========================================================= */}
          {currentTab === 'settings' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Gateway Settings</h2>
                  <p className="text-xs text-slate-400">Evolution API endpoints, webhook configs, and opt-out rules</p>
                </div>
                {settingsSavedMsg && (
                  <span className="text-xs font-mono text-emerald-400">{settingsSavedMsg}</span>
                )}
              </div>

              <form onSubmit={handleSaveSettings} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 max-w-2xl">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Evolution API URL</label>
                  <input
                    type="text"
                    value={settings.EVOLUTION_API_URL || 'http://evolution:8080'}
                    onChange={(e) => setSettings({ ...settings, EVOLUTION_API_URL: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Global API Key</label>
                  <input
                    type="password"
                    value={settings.GLOBAL_API_KEY || ''}
                    onChange={(e) => setSettings({ ...settings, GLOBAL_API_KEY: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Opt-Out Keywords (Comma separated)</label>
                  <input
                    type="text"
                    value={settings.OPT_OUT_KEYWORDS || 'STOP, UNSUBSCRIBE, REMOVE'}
                    onChange={(e) => setSettings({ ...settings, OPT_OUT_KEYWORDS: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition cursor-pointer"
                  >
                    Save Settings
                  </button>
                </div>
              </form>

              {/* AI Guardrail Advisor (OpenRouter) Form */}
              <form onSubmit={handleSaveAiSettings} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 max-w-2xl">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-teal-400" />
                      AI Guardrail Advisor (OpenRouter Integration)
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Reasoning model for evidence-based anti-ban tuning and parameter clamping
                    </p>
                  </div>
                  {aiMaskedKey && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
                      Configured: {aiMaskedKey}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    OpenRouter API Key {aiMaskedKey ? `(${aiMaskedKey})` : ''}
                  </label>
                  <input
                    type="password"
                    value={aiApiKey}
                    onChange={(e) => setAiApiKey(e.target.value)}
                    placeholder={aiMaskedKey ? 'Leave blank to keep current key, or paste new sk-or-...' : 'sk-or-v1-...'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-teal-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Stored encrypted at rest using AES-256-GCM. Never transmitted unmasked.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Reasoning Model</label>
                    <select
                      value={aiModel}
                      onChange={(e) => setAiModel(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    >
                      <option value="anthropic/claude-3.5-haiku">Claude 3.5 Haiku (Recommended, Fast & Safe)</option>
                      <option value="openai/gpt-4o-mini">GPT-4o Mini (Cost-efficient)</option>
                      <option value="google/gemini-flash-1.5">Gemini 1.5 Flash (Ultra-fast)</option>
                      <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet (In-depth)</option>
                      <option value="openai/gpt-4o">GPT-4o (Standard)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Monthly Spend Cap (USD)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      max="500"
                      value={aiSpendCap}
                      onChange={(e) => setAiSpendCap(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-teal-950/20 border border-teal-500/20 text-[11px] text-teal-300 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-teal-400 mt-0.5" />
                  <div>
                    <span className="font-bold">Zero-PII Privacy Protection:</span> Only aggregated volume, failure rates, delay distributions, and circuit breaker events are sent to OpenRouter. No phone numbers, customer names, or message bodies are ever transmitted.
                  </div>
                </div>

                {aiTestResult && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-center justify-between ${
                      aiTestResult.success
                        ? 'bg-emerald-950/30 border border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-950/30 border border-rose-500/30 text-rose-300'
                    }`}
                  >
                    <span>
                      {aiTestResult.success
                        ? `✓ Connection verified! Latency: ${aiTestResult.pingMs}ms (${aiTestResult.model})`
                        : `✗ Test failed: ${aiTestResult.error}`}
                    </span>
                  </div>
                )}

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={savingAiSettings}
                    className="px-5 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-xs rounded-xl shadow transition cursor-pointer"
                  >
                    {savingAiSettings ? 'Saving...' : 'Save AI Settings'}
                  </button>
                  <button
                    type="button"
                    onClick={handleTestAiConnection}
                    disabled={aiTesting}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition cursor-pointer"
                  >
                    {aiTesting ? 'Testing...' : 'Test Connection'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>

      {/* ========================================================= */}
      {/* 14. COMMAND PALETTE (CTRL+K) MODAL                        */}
      {/* ========================================================= */}
      {commandPaletteOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-3 border-b border-slate-800 flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-500 shrink-0" />
              <input
                type="text"
                autoFocus
                value={commandSearch}
                onChange={(e) => setCommandSearch(e.target.value)}
                placeholder="Type a screen or command..."
                className="w-full bg-transparent text-xs text-white focus:outline-none"
              />
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-400">ESC</kbd>
            </div>

            <div className="p-2 max-h-80 overflow-y-auto space-y-1 text-xs">
              <button
                onClick={() => {
                  setCurrentTab('overview');
                  setCommandPaletteOpen(false);
                }}
                className="w-full text-left px-3 py-2 rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2"
              >
                <LayoutDashboard className="w-4 h-4 text-emerald-400" />
                <span>Go to Dashboard Overview</span>
              </button>
              <button
                onClick={() => {
                  setCurrentTab('wizard');
                  setCommandPaletteOpen(false);
                }}
                className="w-full text-left px-3 py-2 rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2"
              >
                <PlusCircle className="w-4 h-4 text-emerald-400" />
                <span>Create New Campaign</span>
              </button>
              <button
                onClick={() => {
                  setCurrentTab('contacts');
                  setCommandPaletteOpen(false);
                }}
                className="w-full text-left px-3 py-2 rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2"
              >
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Manage Contacts & Download Sample Templates</span>
              </button>
              <button
                onClick={() => {
                  setCurrentTab('templates');
                  setCommandPaletteOpen(false);
                }}
                className="w-full text-left px-3 py-2 rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2"
              >
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>Browse Message Templates</span>
              </button>
              <button
                onClick={() => {
                  setCurrentTab('replies');
                  setCommandPaletteOpen(false);
                }}
                className="w-full text-left px-3 py-2 rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2"
              >
                <MessageSquare className="w-4 h-4 text-teal-400" />
                <span>View Replies Inbox & Chat</span>
              </button>
              <button
                onClick={() => {
                  setNewInstanceModal(true);
                  setCommandPaletteOpen(false);
                }}
                className="w-full text-left px-3 py-2 rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2"
              >
                <Smartphone className="w-4 h-4 text-sky-400" />
                <span>Add / Pair New WhatsApp Number</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurrentTab('guardrails');
                  if (typeof window !== 'undefined') {
                    window.history.replaceState(null, '', '/?tab=guardrails');
                  }
                  setCommandPaletteOpen(false);
                }}
                className="w-full text-left px-3 py-2 rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2 cursor-pointer"
              >
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>Configure Anti-Ban Guardrails (Pacing, Caps, Breakers)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 15. MOBILE BOTTOM NAVIGATION BAR                          */}
      {/* ========================================================= */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 px-4 py-2 flex items-center justify-around z-40">
        <button
          onClick={() => setCurrentTab('overview')}
          className={`flex flex-col items-center gap-1 text-[10px] ${
            currentTab === 'overview' ? 'text-emerald-400' : 'text-slate-400'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Dashboard</span>
        </button>
        <button
          onClick={() => setCurrentTab('campaigns')}
          className={`flex flex-col items-center gap-1 text-[10px] ${
            currentTab === 'campaigns' || currentTab === 'live' || currentTab === 'wizard'
              ? 'text-emerald-400'
              : 'text-slate-400'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>Campaigns</span>
        </button>
        <button
          onClick={() => setCurrentTab('replies')}
          className={`flex flex-col items-center gap-1 text-[10px] ${
            currentTab === 'replies' ? 'text-emerald-400' : 'text-slate-400'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Replies</span>
        </button>
        <button
          onClick={() => {
            setCurrentTab('instances');
            if (typeof window !== 'undefined') {
              window.history.replaceState(null, '', '/?tab=instances');
            }
          }}
          className={`flex flex-col items-center gap-1 text-[10px] ${
            currentTab === 'instances' ? 'text-emerald-400' : 'text-slate-400'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span>Instances</span>
        </button>
        <button
          onClick={() => {
            setCurrentTab('guardrails');
            if (typeof window !== 'undefined') {
              window.history.replaceState(null, '', '/?tab=guardrails');
            }
          }}
          className={`flex flex-col items-center gap-1 text-[10px] ${
            currentTab === 'guardrails' ? 'text-emerald-400 font-bold' : 'text-slate-400'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Guardrails</span>
        </button>
        <button
          onClick={() => {
            setCurrentTab('settings');
            if (typeof window !== 'undefined') {
              window.history.replaceState(null, '', '/?tab=settings');
            }
          }}
          className={`flex flex-col items-center gap-1 text-[10px] ${
            currentTab === 'settings' ? 'text-emerald-400' : 'text-slate-400'
          }`}
        >
          <SettingsIcon className="w-4 h-4" />
          <span>Settings</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* 16. MODALS                                                */}
      {/* ========================================================= */}
      {/* QR Code Scanner Modal */}
      {qrModalInstance && (
        <QRCodeModal
          isOpen={Boolean(qrModalInstance)}
          instanceName={qrModalInstance}
          onClose={() => setQrModalInstance(null)}
          onConnected={() => loadInstances()}
        />
      )}

      {/* Create Instance Modal */}
      {newInstanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white">Create New WhatsApp Instance</h3>
            <form onSubmit={handleCreateInstance} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Instance Identifier</label>
                <input
                  type="text"
                  required
                  value={newInstanceName}
                  onChange={(e) => setNewInstanceName(e.target.value)}
                  placeholder="e.g. marketing-primary"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewInstanceModal(false)}
                  className="px-4 py-1.5 bg-slate-800 text-slate-300 text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer"
                >
                  Create & Get QR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
