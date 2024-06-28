const { createClient } = require("@deepgram/sdk");
const fs = require("fs");
const { pipeline } = require("stream/promises");
const axios = require("axios");

const chatbox = document.getElementById("chatbox");
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID;

async function listen(audioBuffer) {
  const form = new FormData();
  form.append("audio", audioBuffer);
  form.append("model_id", ELEVENLABS_VOICE_ID);
  form.append("voice_settings", JSON.stringify({ pitch: 0.5, speed: 1.0 }));
  form.append("seed", "123");

  const options = {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ELEVENLABS_API_KEY}`,
      ...form.getHeaders(),
    },
    data: form,
    url: `https://api.elevenlabs.io/v1/speech-to-speech/${ELEVENLABS_VOICE_ID}`,
  };

  try {
    const response = await axios(options);
    return response.data.transcript;
  } catch (error) {
    console.error('Error during speech-to-text:', error);
  }
}

async function captureAudio() {
  const constraints = { audio: true };
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = async (event) => {
      const audioBuffer = event.data;
      const text = await listen(audioBuffer);
      window.electronAPI.submitMessage("input", text);
    };
    mediaRecorder.start();

    setTimeout(() => {
      mediaRecorder.stop();
    }, 5000); // Capture 5 seconds of audio
  } catch (error) {
    console.error('Error accessing media devices.', error);
  }
}

window.electronAPI.startVoiceCommand(() => {
  captureAudio();
});
