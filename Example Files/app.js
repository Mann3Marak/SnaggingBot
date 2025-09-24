const toggleButton = document.getElementById('toggle-session');
const statusEl = document.getElementById('status');
const userTranscriptEl = document.getElementById('user-transcript');
const assistantTranscriptEl = document.getElementById('assistant-transcript');
const logOutputEl = document.getElementById('event-log');

let pc = null;
let dc = null;
let localStream = null;
let remoteAudioEl = null;
let sessionActive = false;

const userTurns = [];
let liveUserTranscript = '';
const assistantResponses = new Map();
const assistantOrder = [];

const DELTA_TYPES = new Set([
  'conversation.item.input_audio_transcription.delta',
  'response.output_text.delta',
  'response.output_audio_transcript.delta',
]);

function setStatus(message) {
  statusEl.textContent = message;
}

function logEvent(message) {
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.textContent = `${new Date().toLocaleTimeString()} ${message}`;
  logOutputEl.append(entry);
  while (logOutputEl.children.length > 100) {
    logOutputEl.removeChild(logOutputEl.firstChild);
  }
  logOutputEl.scrollTop = logOutputEl.scrollHeight;
}

function resetTranscripts() {
  userTurns.length = 0;
  liveUserTranscript = '';
  assistantResponses.clear();
  assistantOrder.length = 0;
  renderTranscripts();
}

function renderTranscripts() {
  const userSegments = [...userTurns];
  if (liveUserTranscript) {
    userSegments.push(`Listening: ${liveUserTranscript}`);
  }
  userTranscriptEl.textContent = userSegments.length
    ? userSegments.map((line) => `- ${line}`).join('\n\n')
    : 'Press "Start Conversation" and begin speaking when prompted.';

  const assistantSegments = assistantOrder
    .map((id) => assistantResponses.get(id))
    .filter((text) => typeof text === 'string' && text.trim().length > 0);
  assistantTranscriptEl.textContent = assistantSegments.length
    ? assistantSegments
        .map((line, index) => `- ${line}${index === assistantSegments.length - 1 && sessionActive ? ' ...' : ''}`)
        .join('\n\n')
    : 'Assistant responses will appear here.';
}

async function startSession() {
  if (sessionActive) {
    return;
  }

  toggleButton.disabled = true;
  setStatus('Requesting microphone access...');
  logEvent('Starting session.');

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  } catch (error) {
    const message = error?.message ?? 'Microphone permission denied.';
    setStatus('Microphone access required.');
    logEvent(`Microphone error: ${message}`);
    toggleButton.disabled = false;
    return;
  }

  setStatus('Fetching ephemeral key...');

  let ephemeralKey;
  try {
    const tokenResponse = await fetch('/token');
    if (!tokenResponse.ok) {
      throw new Error(`Token request failed (${tokenResponse.status})`);
    }
    const tokenJson = await tokenResponse.json();
    ephemeralKey = tokenJson?.value;
    if (!ephemeralKey) {
      throw new Error('Token response missing "value" field.');
    }
  } catch (error) {
    setStatus('Unable to reach token endpoint.');
    logEvent(`Token error: ${error?.message ?? error}`);
    cleanupMedia();
    toggleButton.disabled = false;
    return;
  }

  try {
    pc = new RTCPeerConnection();
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

    remoteAudioEl = document.createElement('audio');
    remoteAudioEl.autoplay = true;
    remoteAudioEl.playsInline = true;
    remoteAudioEl.hidden = true;
    document.body.append(remoteAudioEl);

    pc.addEventListener('track', (event) => {
      if (remoteAudioEl) {
        remoteAudioEl.srcObject = event.streams[0];
      }
    });

    pc.addEventListener('connectionstatechange', () => {
      const state = pc.connectionState;
      logEvent(`Peer connection state: ${state}`);
      if (state === 'connected') {
        setStatus('Connected. Speak freely.');
      } else if (state === 'failed' || state === 'disconnected') {
        setStatus('Connection lost.');
        stopSession({ keepTranscripts: true });
      }
    });

    dc = pc.createDataChannel('oai-events');

    dc.addEventListener('open', () => {
      sessionActive = true;
      setStatus('Channel open. Listening...');
      toggleButton.textContent = 'End Conversation';
      toggleButton.disabled = false;
      logEvent('Realtime data channel established.');
    });

    dc.addEventListener('close', () => {
      logEvent('Data channel closed.');
      if (sessionActive) {
        setStatus('Channel closed.');
      }
    });

    dc.addEventListener('error', (event) => {
      logEvent(`Data channel error: ${event?.message ?? 'unknown error'}`);
    });

    dc.addEventListener('message', (event) => {
      handleServerEvent(event.data);
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitForIceGathering(pc);

    setStatus('Connecting to OpenAI...');
    const sdpResponse = await fetch('https://api.openai.com/v1/realtime/calls', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ephemeralKey}`,
        'Content-Type': 'application/sdp',
      },
      body: offer.sdp ?? '',
    });

    if (!sdpResponse.ok) {
      const errText = await sdpResponse.text();
      throw new Error(`Realtime API error (${sdpResponse.status}): ${errText}`);
    }

    const answer = {
      type: 'answer',
      sdp: await sdpResponse.text(),
    };

    await pc.setRemoteDescription(answer);
    logEvent('SDP negotiation complete.');
    renderTranscripts();
  } catch (error) {
    setStatus('Failed to start session.');
    logEvent(`Startup error: ${error?.message ?? error}`);
    stopSession({ keepTranscripts: false, silent: true });
    toggleButton.disabled = false;
  }
}

function stopSession({ keepTranscripts = true, silent = false } = {}) {
  const wasActive = sessionActive;
  sessionActive = false;

  if (dc) {
    try {
      if (dc.readyState === 'open' || dc.readyState === 'connecting') {
        dc.close();
      }
    } catch (error) {
      console.debug('Error closing data channel', error);
    }
  }
  dc = null;

  if (pc) {
    try {
      pc.close();
    } catch (error) {
      console.debug('Error closing RTCPeerConnection', error);
    }
  }
  pc = null;

  cleanupMedia();

  toggleButton.textContent = 'Start Conversation';
  toggleButton.disabled = false;

  if (!keepTranscripts) {
    resetTranscripts();
  } else {
    renderTranscripts();
  }

  if (!silent) {
    setStatus('Idle');
    if (wasActive) {
      logEvent('Session stopped.');
    }
  }
}

function cleanupMedia() {
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
  }
  localStream = null;

  if (remoteAudioEl) {
    remoteAudioEl.pause();
    remoteAudioEl.srcObject = null;
    remoteAudioEl.remove();
  }
  remoteAudioEl = null;
}

async function waitForIceGathering(peerConnection) {
  if (peerConnection.iceGatheringState === 'complete') {
    return;
  }
  await new Promise((resolve) => {
    const checkState = () => {
      if (peerConnection.iceGatheringState === 'complete') {
        peerConnection.removeEventListener('icegatheringstatechange', checkState);
        resolve();
      }
    };
    peerConnection.addEventListener('icegatheringstatechange', checkState);
  });
}

function handleServerEvent(rawData) {
  let event;
  try {
    event = JSON.parse(rawData);
  } catch (error) {
    logEvent('Received non-JSON message from server.');
    return;
  }

  if (!event?.type) {
    return;
  }

  if (!DELTA_TYPES.has(event.type)) {
    logEvent(`Server event: ${event.type}`);
  }

  switch (event.type) {
    case 'conversation.item.input_audio_transcription.delta': {
      if (typeof event.delta === 'string') {
        liveUserTranscript += event.delta;
        renderTranscripts();
      }
      break;
    }
    case 'conversation.item.input_audio_transcription.completed': {
      if (typeof event.transcript === 'string' && event.transcript.trim().length > 0) {
        userTurns.push(event.transcript.trim());
      }
      liveUserTranscript = '';
      renderTranscripts();
      break;
    }
    case 'response.output_audio_transcript.delta': {
      if (typeof event.delta === 'string') {
        mergeAssistantText(event.response_id, event.delta);
      }
      break;
    }
    case 'response.output_audio_transcript.done': {
      if (typeof event.transcript === 'string') {
        finalizeAssistantText(event.response_id, event.transcript);
      }
      break;
    }
    case 'response.output_text.delta': {
      if (typeof event.delta === 'string') {
        mergeAssistantText(event.response_id, event.delta);
      }
      break;
    }
    case 'response.output_text.done': {
      const fullText = Array.isArray(event.output_text)
        ? event.output_text.join(' ')
        : event.output_text;
      if (typeof fullText === 'string') {
        finalizeAssistantText(event.response_id, fullText);
      }
      break;
    }
    case 'response.done': {
      if (event.response?.output?.[0]?.content) {
        const textChunk = event.response.output
          .flatMap((item) => item.content ?? [])
          .filter((part) => part?.type === 'output_text')
          .map((part) => part.text)
          .join(' ');
        if (textChunk) {
          finalizeAssistantText(event.response.id, textChunk);
        }
      }
      break;
    }
    default:
      break;
  }
}

function mergeAssistantText(responseId, delta) {
  if (!responseId) {
    return;
  }
  if (!assistantResponses.has(responseId)) {
    assistantResponses.set(responseId, '');
    assistantOrder.push(responseId);
  }
  assistantResponses.set(responseId, `${assistantResponses.get(responseId)}${delta}`);
  renderTranscripts();
}

function finalizeAssistantText(responseId, text) {
  if (!responseId || !text) {
    return;
  }
  if (!assistantResponses.has(responseId)) {
    assistantOrder.push(responseId);
  }
  assistantResponses.set(responseId, text.trim());
  renderTranscripts();
}

toggleButton.addEventListener('click', () => {
  if (sessionActive) {
    stopSession({ keepTranscripts: true });
  } else {
    resetTranscripts();
    startSession();
  }
});

renderTranscripts();
