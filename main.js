const { app, BrowserWindow, screen, ipcMain, globalShortcut } = require("electron");
const path = require("node:path");
const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");
require('dotenv').config();
const config = require("./config");

const { ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID } = process.env;

var petWindow;
var chatboxInputWindow;
var chatboxResponseWindow;
var petOrientation = 1;

function getPetWindowSize() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const petWindowHeight = 272 * config.SCALE;
  const petWindowWidth = 272 * config.SCALE;
  const petWindowSize = {
    width: petWindowWidth,
    height: petWindowHeight,
  };

  return petWindowSize;
}

function petStepHandler(event, dx, dy) {
  const webContents = event.sender;
  const win = BrowserWindow.fromWebContents(webContents);
  const petWindowSize = getPetWindowSize();
  const screenSize = screen.getPrimaryDisplay().workAreaSize;

  let newX = win.getPosition()[0] + dx;
  let newY = win.getPosition()[1] + dy;

  const minX = Math.floor(petWindowSize.width * 0.3) - petWindowSize.width;
  const maxX = screenSize.width - Math.floor(petWindowSize.width * 0.3);

  const minY = Math.floor(petWindowSize.height * 0.3) - petWindowSize.height;
  const maxY = screenSize.height - Math.floor(petWindowSize.height * 0.3);

  if (newX > maxX) {
    newX = minX;
  } else if (newX < minX) {
    newX = maxX;
  }

  if (newY > maxY) {
    newY = minY;
  } else if (newY < minY) {
    newY = maxY;
  }

  win.setBounds({
    width: petWindowSize.width,
    height: petWindowSize.height,
    x: newX,
    y: newY,
  });

  webContents.send('petPosition', { x: newX, y: newY });

  if (petWindow.getPosition()[0] + getPetWindowSize().width > screen.getPrimaryDisplay().workAreaSize.width) {
    return {
      type: "set-orientation",
      value: -1,
    };
  } else if (petWindow.getPosition()[0] < 0) {
    return {
      type: "set-orientation",
      value: 1,
    };
  }

  return {};
}

function initPositionHandler(event) {
  const webContents = event.sender;
  const win = BrowserWindow.fromWebContents(webContents);
  const screenSize = screen.getPrimaryDisplay().workAreaSize;

  let newX = win.getPosition()[0];
  let newY = win.getPosition()[1];
  webContents.send('petPosition', { x: newX, y: newY });
  return { screenWidth: screenSize.width, screenHeight: screenSize.height };
}

function createPetWindow() {
  const petWindowSize = getPetWindowSize();

  petWindow = new BrowserWindow({
    width: petWindowSize.width,
    height: petWindowSize.height,
    x: 0,
    y: screen.getPrimaryDisplay().workAreaSize.height - getPetWindowSize().height,
    transparent: true,
    frame: false,
    useContentSize: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: true,
      enableRemoteModule: true,
    },
  });

  petWindow.loadFile("pet.html");
  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  petWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  petWindow.setIgnoreMouseEvents(true);
}

function createChatboxInputWindow() {
  chatboxInputWindow = new BrowserWindow({
    width: 600,
    height: 56,
    transparent: true,
    frame: false,
    skipTaskbar: true,
    useContentSize: true,
    resizable: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: true,
      enableRemoteModule: true,
    },
  });

  chatboxInputWindow.loadFile("chatbox-input.html");
  chatboxInputWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  chatboxInputWindow.setAlwaysOnTop(true, 'screen-saver', 1);
}

function createChatboxResponseWindow() {
  chatboxResponseWindow = new BrowserWindow({
    width: 1000 * config.SCALE,
    height: 600 * config.SCALE,
    transparent: true,
    frame: false,
    skipTaskbar: true,
    useContentSize: true,
    resizable: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: true,
      enableRemoteModule: true,
    },
  });

  chatboxResponseWindow.loadFile("chatbox-response.html");
  chatboxResponseWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  chatboxResponseWindow.setAlwaysOnTop(true, 'screen-saver', 1);

  return chatboxResponseWindow;
}

function showMessage(message) {
  if (petWindow.getPosition()[0] + getPetWindowSize().width / 2 < screen.getPrimaryDisplay().workAreaSize.width / 2) {
    petOrientation = 1;
  } else {
    petOrientation = -1;
  }

  chatboxResponseWindow.webContents.send("message", {
    text: message,
    orientation: petOrientation,
  });
  petWindow.webContents.send("message", {
    text: "response-open",
    orientation: petOrientation,
  });

  chatboxResponseWindow.hide();

  chatboxResponseWindow.setBounds({
    width: 800 * config.SCALE,
    height: 400 * config.SCALE,
    x: petWindow.getPosition()[0] - (700 * config.SCALE),
    y: petWindow.getPosition()[1] - (300 * config.SCALE),
  });
  chatboxResponseWindow.show();
}

var processingMessage = false;

async function handleSubmitMessage(event, type, message) {
  const webContents = event.sender;
  const win = BrowserWindow.fromWebContents(webContents);

  if (type === "input") {
    processingMessage = true;
    petWindow.webContents.send("message", {
      text: "processing-message",
      orientation: petOrientation,
    });

    win.hide();

    const audioPath = await convertTextToSpeech(message);
    playAudioResponse(audioPath);
    processingMessage = false;
  } else if (type === "response-size") {
    const width = Math.ceil(message.width);
    const height = Math.ceil(message.height);

    let responsePositionX = 0;
    if (petOrientation == 1) {
      responsePositionX = Math.max(0,
        Math.min(
          petWindow.getPosition()[0] + getPetWindowSize().width - (50 * config.SCALE),
          screen.getPrimaryDisplay().workAreaSize.width - width
        )
      );
    } else {
      responsePositionX = Math.max(0,
        Math.min(
          petWindow.getPosition()[0] - width + 70,
          screen.getPrimaryDisplay().workAreaSize.width - width
        )
      );
    }

    const responsePositionY = petWindow.getPosition()[1] - height + (50 * config.SCALE);
    chatboxResponseWindow.setBounds({
      width: width,
      height: height,
      x: responsePositionX,
      y: responsePositionY,
    });

    chatboxResponseWindow.show();
  } else if (type === "response-close") {
    win.hide();
    petWindow.webContents.send("message", { text: "response-close" });
  }
}

async function convertTextToSpeech(text) {
  const form = new FormData();
  form.append("text", text);
  form.append("voice_settings", JSON.stringify({ pitch: 0.5, speed: 1.0 }));

  const options = {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ELEVENLABS_API_KEY}`,
      ...form.getHeaders(),
    },
    data: form,
    url: `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
    responseType: 'stream',
  };

  const response = await axios(options);

  const outputPath = path.join(__dirname, 'response_audio.mp3');
  const writer = fs.createWriteStream(outputPath);
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve(outputPath));
    writer.on('error', reject);
  });
}

function playAudioResponse(audioPath) {
  const audio = new Audio(audioPath);
  audio.play();
}

app.whenReady().then(() => {
  ipcMain.on('submit-message', handleSubmitMessage);
  ipcMain.handle('pet-step', petStepHandler);
  ipcMain.handle('init-position', initPositionHandler);

  createPetWindow();
  createChatboxInputWindow();
  createChatboxResponseWindow();

  globalShortcut.register('CommandOrControl+L', () => {
    if (processingMessage) return;

    chatboxInputWindow.webContents.send("start-voice-command");
    chatboxInputWindow.show();
  });

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
