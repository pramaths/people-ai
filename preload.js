const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  screenInfo: () => ipcRenderer.invoke('init-position'),
  petStep: (dx, dy) => ipcRenderer.invoke('pet-step', dx, dy),
  submitMessage: (type, message) => ipcRenderer.send('submit-message', type, message),
  onReceiveMessage: (callback) => ipcRenderer.on('message', (_event, message) => callback(message)),
  onShow: (callback) => ipcRenderer.on('show', (_event) => callback()),
  startVoiceCommand: (callback) => ipcRenderer.on('start-voice-command', (_event) => callback())
});

ipcRenderer.on('petPosition', (event, newPosition) => {
  window.dispatchEvent(new CustomEvent('petPosition', { detail: newPosition }));
});
