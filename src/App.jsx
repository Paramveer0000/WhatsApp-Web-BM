import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import LiveDashboard from './components/LiveDashboard';
import NewCampaignWizard from './components/NewCampaignWizard';
import InstancesView from './components/InstancesView';
import CampaignHistory from './components/CampaignHistory';
import SettingsModal from './components/SettingsModal';
import CreateInstanceModal from './components/CreateInstanceModal';
import QRCodeModal from './components/QRCodeModal';

export default function App() {
  const [currentTab, setCurrentTab] = useState('wizard'); // 'dashboard' | 'wizard' | 'instances' | 'history'
  const [activeCampaignId, setActiveCampaignId] = useState(null);
  const [activeCampaign, setActiveCampaign] = useState(null);

  // Settings & Evolution state
  const [settings, setSettings] = useState({
    evolution_api_url: 'http://localhost:8080',
    global_api_key: '',
    default_country_code: '91',
    default_min_delay: '12',
    default_max_delay: '25',
    default_simulate_typing: '1'
  });

  const [instances, setInstances] = useState([]);
  const [selectedInstance, setSelectedInstance] = useState('');
  const [connectionState, setConnectionState] = useState('unknown');
  const [loadingInstances, setLoadingInstances] = useState(false);

  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreateInstanceOpen, setIsCreateInstanceOpen] = useState(false);
  const [isQROpen, setIsQROpen] = useState(false);
  const [qrInstanceName, setQrInstanceName] = useState('');

  // Initial Data Load
  useEffect(() => {
    loadSettings();
    loadLatestCampaign();
  }, []);

  // When settings change or instances refresh, fetch instance connection state
  useEffect(() => {
    if (selectedInstance) {
      checkInstanceConnectionState(selectedInstance);
    }
  }, [selectedInstance]);

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.success && data.settings) {
        setSettings(data.settings);
        loadInstances();
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  const loadInstances = async () => {
    try {
      setLoadingInstances(true);
      const res = await fetch('/api/evolution/instances');
      const data = await res.json();
      if (data.success) {
        const list = Array.isArray(data.instances) ? data.instances : [];
        setInstances(list);

        if (list.length > 0 && !selectedInstance) {
          const first = list[0];
          const name = first.instance?.instanceName || first.name || first.instanceName;
          if (name) {
            setSelectedInstance(name);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching instances:', err);
    } finally {
      setLoadingInstances(false);
    }
  };

  const checkInstanceConnectionState = async (name) => {
    try {
      const res = await fetch(`/api/evolution/state/${encodeURIComponent(name)}`);
      const data = await res.json();
      setConnectionState(data.state || 'unknown');
    } catch (err) {
      setConnectionState('error');
    }
  };

  const loadLatestCampaign = async () => {
    try {
      const res = await fetch('/api/campaigns');
      const data = await res.json();
      if (data.success && data.campaigns && data.campaigns.length > 0) {
        // Look for running or paused campaign first
        const active = data.campaigns.find(c => c.status === 'running' || c.status === 'paused');
        if (active) {
          setActiveCampaignId(active.id);
          setActiveCampaign(active);
          setCurrentTab('dashboard');
        } else {
          setActiveCampaignId(data.campaigns[0].id);
          setActiveCampaign(data.campaigns[0]);
        }
      }
    } catch (err) {
      console.error('Error loading latest campaign:', err);
    }
  };

  // Handlers
  const handleCampaignCreated = (campaign) => {
    setActiveCampaignId(campaign.id);
    setActiveCampaign(campaign);
    setCurrentTab('dashboard');
  };

  const handleSelectCampaign = (id) => {
    setActiveCampaignId(id);
    setCurrentTab('dashboard');
  };

  const handleOpenQR = (instName) => {
    setQrInstanceName(instName || selectedInstance);
    setIsQROpen(true);
  };

  const handleInstanceCreated = (newInstanceName) => {
    loadInstances();
    setSelectedInstance(newInstanceName);
    handleOpenQR(newInstanceName);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Navigation Header */}
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenSettings={() => setIsSettingsOpen(true)}
        instances={instances}
        selectedInstance={selectedInstance}
        activeCampaign={activeCampaign}
        connectionState={connectionState}
        onRefreshInstances={loadInstances}
        loadingInstances={loadingInstances}
      />

      {/* Main App Content */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
        {currentTab === 'dashboard' && (
          <LiveDashboard
            campaignId={activeCampaignId}
            onOpenQR={handleOpenQR}
            onNavigateWizard={() => setCurrentTab('wizard')}
          />
        )}

        {currentTab === 'wizard' && (
          <NewCampaignWizard
            instances={instances}
            selectedInstance={selectedInstance}
            setSelectedInstance={setSelectedInstance}
            settings={settings}
            onCampaignCreated={handleCampaignCreated}
          />
        )}

        {currentTab === 'instances' && (
          <InstancesView
            instances={instances}
            loading={loadingInstances}
            onRefresh={loadInstances}
            onCreateNew={() => setIsCreateInstanceOpen(true)}
            onOpenQR={handleOpenQR}
            onSelectInstance={(name) => {
              setSelectedInstance(name);
              checkInstanceConnectionState(name);
            }}
            selectedInstance={selectedInstance}
            settings={settings}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        )}

        {currentTab === 'history' && (
          <CampaignHistory
            onSelectCampaign={handleSelectCampaign}
            onNavigateWizard={() => setCurrentTab('wizard')}
          />
        )}
      </main>

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={(newSettings) => {
          setSettings(newSettings);
          loadInstances();
        }}
      />

      <CreateInstanceModal
        isOpen={isCreateInstanceOpen}
        onClose={() => setIsCreateInstanceOpen(false)}
        onCreated={handleInstanceCreated}
      />

      <QRCodeModal
        isOpen={isQROpen}
        instanceName={qrInstanceName}
        onClose={() => {
          setIsQROpen(false);
          loadInstances();
        }}
        onConnected={(name) => {
          checkInstanceConnectionState(name);
        }}
      />
    </div>
  );
}

