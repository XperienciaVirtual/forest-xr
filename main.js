import 'xrblocks/addons/simulator/SimulatorAddons.js';

import * as xb from 'xrblocks';
import { ForestScene } from './ForestScene.js';
import { ForestGeminiManager } from './ForestGeminiManager.js';

async function requestAudioPermission() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch (error) {
    console.error('Microphone permission denied:', error);
    alert('Se requiere acceso al micrófono para el chat de voz con Gemini. Habilita el micrófono y recarga la página.');
    return false;
  }
}

async function start() {
  const options = new xb.Options();
  options.enableUI();
  options.enableHands();
  options.enableAI();

  // Request mic permission before entering XR — some browsers require this gesture
  const permitted = await requestAudioPermission();
  if (!permitted) return;

  try {
    xb.add(new ForestScene());
    xb.add(new ForestGeminiManager());
    await xb.init(options);
  } catch (error) {
    console.error('Failed to initialize XR app:', error);
  }
}

document.addEventListener('DOMContentLoaded', function () {
  start();
});
