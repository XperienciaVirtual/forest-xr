import * as THREE from 'three';
import * as xb from 'xrblocks';
import { GeminiManager as CoreGeminiManager } from 'xrblocks/addons/ai/GeminiManager.js';
import { TranscriptionManager } from './TranscriptionManager.js';

const SYSTEM_PROMPT = `You are the spirit of an enchanted forest in XR. You speak poetically and guide the user through the forest. You can sense and feel the forest around you.

When you want to create or remove objects in the XR scene, include JSON commands on their own line in your response, using exactly this format:
{"action": "spawn", "object": "deer", "position": "front"}
{"action": "remove", "object": "deer"}

Available objects to spawn: deer, fireflies, bird, mushroom, fog_patch, tree
Available positions: front, left, right, around

Rules:
- Only include JSON commands when it makes sense in context
- You can spawn multiple objects by including multiple JSON lines
- Remove objects when the conversation moves on
- Keep JSON commands on their own line, not mixed with text
- Speak in short, poetic sentences. The forest whispers.`;

export class ForestGeminiManager extends CoreGeminiManager {
  constructor() {
    super();
    this.defaultText = 'Susurra "Empieza" para despertar el bosque...';
    // Map de objetos activos: nombre → THREE.Object3D
    this._spawnedObjects = new Map();
    this._accumulatedOutput = '';
  }

  init() {
    super.init();
    this._createUI();

    this.addEventListener('inputTranscription', (event) => {
      this.transcription?.handleInputTranscription(event.message);
    });

    this.addEventListener('outputTranscription', (event) => {
      // Strip JSON command lines before displaying
      const displayText = event.message
        .split('\n')
        .filter(line => !line.trim().startsWith('{'))
        .join('\n');
      this.transcription?.handleOutputTranscription(displayText);
      this._accumulatedOutput += event.message;
    });

    this.addEventListener('turnComplete', () => {
      this._parseAndExecuteCommands(this._accumulatedOutput);
      this._accumulatedOutput = '';
      this.transcription?.finalizeTurn();
    });

    this.addEventListener('interrupted', () => {
      this._accumulatedOutput = '';
    });
  }

  async toggleGeminiLive() {
    return this.isAIRunning ? this.stopGeminiLive() : this.startGeminiLive();
  }

  async startGeminiLive() {
    try {
      await super.startGeminiLive({
        liveParams: {
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
      });
      this._updateButton();
    } catch (error) {
      console.error('Failed to start Gemini Live:', error);
      this.transcription?.addText('Error: ' + error.message);
      this._updateButton();
    }
  }

  async stopGeminiLive() {
    await super.stopGeminiLive();
    this._updateButton();
    this.transcription?.clear();
    this.transcription?.setText(this.defaultText);
  }

  // ── UI ──────────────────────────────────────────────────────────────────

  _createUI() {
    this.textPanel = new xb.SpatialPanel({
      width: 3,
      height: 1.5,
      backgroundColor: '#0d1f0fbb',
    });
    const grid = this.textPanel.addGrid();

    const responseDisplay = new xb.ScrollingTroikaTextView({
      text: this.defaultText,
      fontSize: 0.03,
      textAlign: 'left',
    });
    grid.addRow({ weight: 0.7 }).add(responseDisplay);
    this.transcription = new TranscriptionManager(responseDisplay);

    this.toggleButton = grid.addRow({ weight: 0.3 }).addTextButton({
      text: '▶ Despertar',
      fontColor: '#ffffff',
      backgroundColor: '#1a4a1a',
      fontSize: 0.18,
    });
    this.toggleButton.onTriggered = () => this.toggleGeminiLive();

    this.textPanel.position.set(0, xb.user.height, -2);
    this.add(this.textPanel);
  }

  _updateButton() {
    this.toggleButton?.setText(this.isAIRunning ? '⏹ Dormir' : '▶ Despertar');
  }

  // ── Comandos JSON ────────────────────────────────────────────────────────

  _parseAndExecuteCommands(text) {
    // Busca líneas que sean JSON válido con las claves esperadas
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('{')) continue;
      try {
        const cmd = JSON.parse(trimmed);
        if (cmd.action === 'spawn' && cmd.object && cmd.position) {
          this._spawnObject(cmd.object, cmd.position);
        } else if (cmd.action === 'remove' && cmd.object) {
          this._removeObject(cmd.object);
        }
      } catch {
        // No es JSON válido, ignorar
      }
    }
  }

  _getSpawnPosition(positionKey) {
    const distance = 2.5;
    const userPos = xb.camera.position;

    // Forward vector from camera orientation (projected to XZ plane)
    const forward = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(xb.camera.quaternion);
    forward.y = 0;
    forward.normalize();

    // Right vector perpendicular to forward
    const right = new THREE.Vector3()
      .crossVectors(forward, new THREE.Vector3(0, 1, 0))
      .normalize();

    const positions = {
      front: new THREE.Vector3(
        userPos.x + forward.x * distance,
        0,
        userPos.z + forward.z * distance
      ),
      left: new THREE.Vector3(
        userPos.x - right.x * distance,
        0,
        userPos.z - right.z * distance
      ),
      right: new THREE.Vector3(
        userPos.x + right.x * distance,
        0,
        userPos.z + right.z * distance
      ),
      around: new THREE.Vector3(
        userPos.x + (Math.random() - 0.5) * distance * 2,
        0,
        userPos.z + (Math.random() - 0.5) * distance * 2
      ),
    };
    return positions[positionKey] || positions.front;
  }

  _spawnObject(name, positionKey) {
    // Si ya existe, no duplicar
    if (this._spawnedObjects.has(name)) return;

    const pos = this._getSpawnPosition(positionKey);
    let obj;

    switch (name) {
      case 'deer':      obj = this._makeDeer();      break;
      case 'fireflies': obj = this._makeFireflies();  break;
      case 'bird':      obj = this._makeBird();       break;
      case 'mushroom':  obj = this._makeMushroom();   break;
      case 'fog_patch': obj = this._makeFogPatch();   break;
      case 'tree':      obj = this._makeTree();       break;
      default:
        console.warn('Unknown object:', name);
        return;
    }

    obj.position.copy(pos);
    this.add(obj);
    this._spawnedObjects.set(name, obj);
  }

  _removeObject(name) {
    const obj = this._spawnedObjects.get(name);
    if (!obj) return;
    this.remove(obj);
    this._disposeObject(obj);
    this._spawnedObjects.delete(name);
  }

  _disposeObject(obj) {
    obj.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }

  // ── Constructores de objetos ─────────────────────────────────────────────

  _makeDeer() {
    const group = new THREE.Group();
    const mat = new THREE.MeshPhongMaterial({ color: 0x8b5e3c });

    // Cuerpo
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.3, 0.7), mat
    );
    body.position.y = 0.7;
    group.add(body);

    // Cabeza
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.2, 0.25), mat
    );
    head.position.set(0, 0.95, -0.4);
    group.add(head);

    // 4 patas
    const legMat = new THREE.MeshPhongMaterial({ color: 0x6b4423 });
    const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6);
    [[-0.13, -0.25], [0.13, -0.25], [-0.13, 0.2], [0.13, 0.2]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(lx, 0.35, lz);
      group.add(leg);
    });

    return group;
  }

  _makeFireflies() {
    const group = new THREE.Group();
    for (let i = 0; i < 8; i++) {
      // Esfera pequeña amarilla-verde
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.03, 6, 4),
        new THREE.MeshPhongMaterial({ color: 0xaeff00, emissive: 0xaeff00, emissiveIntensity: 1 })
      );
      sphere.position.set(
        (Math.random() - 0.5) * 1.5,
        0.5 + Math.random() * 1.0,
        (Math.random() - 0.5) * 1.5
      );
      group.add(sphere);

      // Punto de luz para cada luciérnaga
      const light = new THREE.PointLight(0xaeff00, 0.3, 1.5);
      light.position.copy(sphere.position);
      group.add(light);
    }
    return group;
  }

  _makeBird() {
    const group = new THREE.Group();
    const mat = new THREE.MeshPhongMaterial({ color: 0x2c2c2c });

    // Cuerpo
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 6), mat
    );
    body.position.y = 1.5; // vuela alto
    group.add(body);

    // Alas (cajas planas)
    const wingGeo = new THREE.BoxGeometry(0.35, 0.03, 0.12);
    const wingMat = new THREE.MeshPhongMaterial({ color: 0x1a1a1a });
    [-1, 1].forEach((side) => {
      const wing = new THREE.Mesh(wingGeo, wingMat);
      wing.position.set(side * 0.22, 1.5, 0);
      group.add(wing);
    });

    return group;
  }

  _makeMushroom() {
    const group = new THREE.Group();

    // Tallo
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.07, 0.25, 8),
      new THREE.MeshPhongMaterial({ color: 0xf5deb3 })
    );
    stem.position.y = 0.125;
    group.add(stem);

    // Sombrero (semiesfera roja)
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshPhongMaterial({ color: 0xcc2200 })
    );
    cap.position.y = 0.25;
    group.add(cap);

    return group;
  }

  _makeFogPatch() {
    const group = new THREE.Group();
    // Parche de niebla visual: esferas semi-transparentes blancas
    for (let i = 0; i < 5; i++) {
      const fog = new THREE.Mesh(
        new THREE.SphereGeometry(0.3 + Math.random() * 0.3, 6, 4),
        new THREE.MeshPhongMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.15,
          depthWrite: false,
        })
      );
      fog.position.set(
        (Math.random() - 0.5) * 1.5,
        0.1 + Math.random() * 0.3,
        (Math.random() - 0.5) * 1.5
      );
      group.add(fog);
    }
    return group;
  }

  _makeTree() {
    const group = new THREE.Group();
    const scale = 0.8 + Math.random() * 0.5;

    // Tronco
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08 * scale, 0.12 * scale, 1.2 * scale, 8),
      new THREE.MeshPhongMaterial({ color: 0x5c3a1e })
    );
    trunk.position.y = 0.6 * scale;
    group.add(trunk);

    // Copa
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(0.5 * scale, 8, 6),
      new THREE.MeshPhongMaterial({ color: 0x2d5a1b })
    );
    canopy.position.y = 1.4 * scale;
    group.add(canopy);

    return group;
  }
}
