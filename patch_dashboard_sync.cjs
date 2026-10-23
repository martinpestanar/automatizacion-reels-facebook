const fs = require('fs');

let content = fs.readFileSync('dashboard/src/App.jsx', 'utf8');

// 1. Sincronizar flowSettings y automationConfig en fetchData
const oldSync = `      if (settingsData && settingsData.description) {
        try {
          const parsed = JSON.parse(settingsData.description);
          setFlowSettings(prev => ({ ...prev, ...parsed }));
        } catch (e) {
          console.warn('Error reading flow_settings_config', e);
        }
      }`;

const newSync = `      if (settingsData && settingsData.description) {
        try {
          const parsed = JSON.parse(settingsData.description);
          setFlowSettings(prev => ({ ...prev, ...parsed }));
          if (parsed.automation_enabled !== undefined || parsed.daily_target_videos) {
            setAutomationConfig(prev => ({
              ...prev,
              enabled: parsed.automation_enabled !== undefined ? parsed.automation_enabled : prev.enabled,
              dailyQuantity: parsed.daily_target_videos || prev.dailyQuantity,
              publishToStories: parsed.publish_to_stories !== undefined ? parsed.publish_to_stories : prev.publishToStories,
              source: parsed.source || prev.source
            }));
          }
        } catch (e) {
          console.warn('Error reading flow_settings_config', e);
        }
      }`;

if (content.includes(oldSync)) {
  content = content.replace(oldSync, newSync);
  console.log('fetchData sync patched!');
} else {
  console.log('oldSync not found');
}

// 2. Patch modal save button
const targetBtn = `              <button
                type="button"
                onClick={() => {
                  setShowAutomationModal(false);
                  showToast('✅ Configuración del Auto-Piloto guardada correctamente');
                }}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition cursor-pointer"
              >
                Guardar y Cerrar
              </button>`;

const replacementBtn = `              <button
                type="button"
                onClick={async () => {
                  setShowAutomationModal(false);
                  showToast('Sincronizando piloto automático con VPS...');
                  try {
                    const updatedConfig = {
                      ...flowSettings,
                      automation_enabled: automationConfig.enabled,
                      daily_target_videos: automationConfig.dailyQuantity,
                      publish_to_stories: automationConfig.publishToStories,
                      source: automationConfig.source
                    };
                    setFlowSettings(updatedConfig);
                    await supabase
                      .from('image_formats')
                      .update({ description: JSON.stringify(updatedConfig) })
                      .eq('code', 'flow_settings_config');
                    showToast('✅ Configuración guardada en VPS (' + automationConfig.dailyQuantity + ' videos/día)');
                  } catch (e) {
                    showToast('Error al sincronizar con VPS');
                  }
                }}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition cursor-pointer"
              >
                Guardar y Aplicar en VPS
              </button>`;

if (content.includes(targetBtn)) {
  content = content.replace(targetBtn, replacementBtn);
  console.log('Modal save button patched!');
} else {
  console.log('targetBtn not found');
}

// 3. Patch top header quick toggle
const oldToggle = `                onClick={(e) => {
                  e.stopPropagation();
                  setAutomationConfig(prev => {
                    const next = !prev.enabled;
                    showToast(next ? \`🚀 Piloto Automático ACTIVADO: \${prev.dailyQuantity} al día (\${prev.source === 'vault' ? 'Mi Banco' : 'Agente IA'})\` : '⏸️ Piloto Automático PAUSADO');
                    return { ...prev, enabled: next };
                  });
                }}`;

const newToggle = `                onClick={async (e) => {
                  e.stopPropagation();
                  const next = !automationConfig.enabled;
                  setAutomationConfig(prev => ({ ...prev, enabled: next }));
                  showToast(next ? '🚀 Piloto Automático VPS ACTIVADO' : '⏸️ Piloto Automático VPS PAUSADO');
                  try {
                    const updatedConfig = { ...flowSettings, automation_enabled: next };
                    setFlowSettings(updatedConfig);
                    await supabase
                      .from('image_formats')
                      .update({ description: JSON.stringify(updatedConfig) })
                      .eq('code', 'flow_settings_config');
                  } catch (err) {
                    console.error('Error toggling automation in Supabase:', err);
                  }
                }}`;

if (content.includes(oldToggle)) {
  content = content.replace(oldToggle, newToggle);
  console.log('Header quick toggle patched!');
} else {
  console.log('oldToggle not found');
}

fs.writeFileSync('dashboard/src/App.jsx', content);
console.log('All patches applied cleanly to dashboard/src/App.jsx');
