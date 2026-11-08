'use client';

import React, { useState, useEffect } from 'react';
import { BotListView } from './BotListView';
import { FlowEditor } from './FlowEditor';
import { TemplateGalleryModal } from './TemplateGalleryModal';

interface ChatbotStudioTabProps {
  instances: Array<{ id: string; name: string }>;
  toast: any;
}

export function ChatbotStudioTab({ instances, toast }: ChatbotStudioTabProps) {
  const [bots, setBots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBotId, setActiveBotId] = useState<string | null>(null);
  const [activeBotData, setActiveBotData] = useState<any | null>(null);
  const [isTemplateGalleryOpen, setIsTemplateGalleryOpen] = useState(false);
  const [isPausingAll, setIsPausingAll] = useState(false);

  // Load all bots
  const loadBots = async () => {
    try {
      const res = await fetch('/api/v1/bots');
      const data = await res.json();
      if (data.success && Array.isArray(data.bots)) {
        setBots(data.bots);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load bots');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBots();
  }, []);

  // Open a specific bot in Visual Editor
  const handleSelectBot = async (botId: string) => {
    try {
      const res = await fetch(`/api/v1/bots/${botId}`);
      const data = await res.json();
      if (data.success && data.bot) {
        setActiveBotData(data.bot);
        setActiveBotId(botId);
      } else {
        toast.error(data.error || 'Failed to load bot details');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to open bot in studio');
    }
  };

  // Create new bot (from template or blank)
  const handleCreateFromTemplate = async (templateKey: string | null) => {
    try {
      const res = await fetch('/api/v1/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateKey }),
      });
      const data = await res.json();
      if (data.success && data.botId) {
        setIsTemplateGalleryOpen(false);
        toast.success('Chatbot created! Opening visual editor...');
        await handleSelectBot(data.botId);
        loadBots();
      } else {
        toast.error(data.error || 'Failed to create bot');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error creating bot');
    }
  };

  // Toggle Bot Status (Live / Paused)
  const handleToggleStatus = async (botId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'live' ? 'paused' : 'live';
    try {
      const res = await fetch(`/api/v1/bots/${botId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Bot status changed to ${nextStatus.toUpperCase()}`);
        loadBots();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    }
  };

  // Duplicate Bot
  const handleDuplicateBot = async (botId: string) => {
    try {
      const res = await fetch(`/api/v1/bots/${botId}/duplicate`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success('Bot duplicated successfully');
        loadBots();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to duplicate bot');
    }
  };

  // Delete Bot
  const handleDeleteBot = async (botId: string) => {
    if (!confirm('Are you sure you want to permanently delete this chatbot?')) return;
    try {
      const res = await fetch(`/api/v1/bots/${botId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Bot deleted successfully');
        loadBots();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete bot');
    }
  };

  // Save Bot Draft
  const handleSaveBot = async (botId: string, updated: any) => {
    try {
      await fetch(`/api/v1/bots/${botId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
    } catch (err: any) {
      console.error('Autosave error:', err);
    }
  };

  // Publish Bot
  const handlePublishBot = async (botId: string, note?: string) => {
    const res = await fetch(`/api/v1/bots/${botId}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Publish failed');
    }
    loadBots();
    return data;
  };

  // Emergency Pause / Resume All
  const handlePauseAll = async () => {
    setIsPausingAll(true);
    try {
      const anyLive = bots.some((b) => b.status === 'live');
      const res = await fetch('/api/v1/bots/pause-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume: !anyLive }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        loadBots();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to toggle bots');
    } finally {
      setIsPausingAll(false);
    }
  };

  // Visual Editor View
  if (activeBotId && activeBotData) {
    return (
      <FlowEditor
        botId={activeBotId}
        initialBot={activeBotData}
        availableInstances={instances}
        onBack={() => {
          setActiveBotId(null);
          setActiveBotData(null);
          loadBots();
        }}
        onSaveBot={handleSaveBot}
        onPublishBot={handlePublishBot}
      />
    );
  }

  // List View
  return (
    <>
      <BotListView
        bots={bots}
        availableInstances={instances}
        onSelectBot={handleSelectBot}
        onOpenTemplateGallery={() => setIsTemplateGalleryOpen(true)}
        onToggleStatus={handleToggleStatus}
        onDuplicateBot={handleDuplicateBot}
        onDeleteBot={handleDeleteBot}
        onPauseAll={handlePauseAll}
        isPausingAll={isPausingAll}
      />

      <TemplateGalleryModal
        isOpen={isTemplateGalleryOpen}
        onClose={() => setIsTemplateGalleryOpen(false)}
        onSelectTemplate={handleCreateFromTemplate}
      />
    </>
  );
}

