
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
      
      // If authentication fails, try to use the interactive bridge
      const isAuthError = 
        msg.includes("API Key must be set") || 
        msg.includes("API_KEY_MISSING") || 
        msg.includes("Requested entity was not found.") ||
        error.status === 403 || 
        error.status === 401;

      if (isAuthError && window.aistudio) {
        try {
          // Trigger the official key picker
          await window.aistudio.openSelectKey();
          // Reset to dashboard so user can click generate again after picking key
          setState('dashboard');
          return;
        } catch (bridgeErr) {
          console.error("Bridge key selection failed", bridgeErr);
        }
      }

      // If we're here, either it wasn't an auth error or the bridge isn't available
      if (isAuthError) {
        alert(
          "Authentication Error: The API Key is not accessible to the browser. " +
          "If you are using Vercel, please verify your environment variables and redeploy."
        );
      } else {
        alert(`Generation Error: ${msg || "An unexpected error occurred. Please try again."}`);
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
