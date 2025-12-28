
import React, { useState } from 'react';
import { AppState, ShopInputs, WebsiteData } from './types.ts';
import { Dashboard } from './components/Dashboard.tsx';
import { LoadingScreen } from './components/LoadingScreen.tsx';
import { GeneratedWebsite } from './components/GeneratedWebsite.tsx';
import { generateContent } from './services/geminiService.ts';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>('dashboard');
  const [generatedData, setGeneratedData] = useState<WebsiteData | null>(null);

  const handleGenerate = async (inputs: ShopInputs) => {
    setState('loading');
    try {
      const data = await generateContent(inputs);
      setGeneratedData(data);
      setState('generated');
    } catch (error: any) {
      console.error("Website generation failed:", error);
      
      const msg = error.message || "";
      
      // If the service reported a missing key, try to use the interactive bridge
      if (msg === "API_KEY_MISSING" || msg.includes("API Key must be set")) {
        if (window.aistudio) {
          await window.aistudio.openSelectKey();
          // We don't alert here, assuming the user will retry after selecting a key
          setState('dashboard');
          return;
        } else {
          alert("Configuration Error: The 'API_KEY' environment variable is not accessible to the browser. If you added it to Vercel, please ensure you prefixed it with VITE_ or that your deployment has been rebuilt.");
        }
      } else if (msg.includes("Requested entity was not found.") && window.aistudio) {
        await window.aistudio.openSelectKey();
      } else if (error.status === 403 || error.status === 401) {
        alert("Authentication Error: The provided API Key is invalid or expired.");
      } else {
        alert(`Generation Error: ${msg || "An unexpected error occurred."}`);
      }
      
      setState('dashboard');
    }
  };

  const handleBack = () => {
    setState('dashboard');
    setGeneratedData(null);
  };

  return (
    <div className="min-h-screen bg-[#0d0d0d]">
      {state === 'dashboard' && <Dashboard onGenerate={handleGenerate} />}
      {state === 'loading' && <LoadingScreen />}
      {state === 'generated' && generatedData && (
        <GeneratedWebsite data={generatedData} onBack={handleBack} />
      )}
    </div>
  );
};

export default App;
