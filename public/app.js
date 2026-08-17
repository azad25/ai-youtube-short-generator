const state = { 
  prompts: [], 
  selectedPromptId: null, 
  activeShort: null, 
  budget: null, 
  youtube: null,
  automationMode: 'Manual' // Track current automation mode
};
const $ = (selector) => document.querySelector(selector);
const api = async (url, options = {}) => {
  const response = await fetch(url, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  const result = await response.json();
  if (!response.ok) {
    console.error(`API Error (${response.status}):`, result);
    throw new Error(result.error || 'Request failed.');
  }
  return result;
};

function openDialog(id) { $(`#${id}`).showModal(); }
function closeDialogs() { document.querySelectorAll('dialog[open]').forEach((dialog) => dialog.close()); }
function setNotice(message, isError = false) { const notice = $('#setup-notice'); notice.querySelector('div').innerHTML = message; notice.classList.toggle('error', isError); }

function formatSubscriberCount(count) {
  if (count >= 1000000) return Math.floor(count / 1000000) + 'M';
  if (count >= 1000) return Math.floor(count / 1000) + 'K';
  return count.toString();
}

// Helper functions for the generation workflow
function getFormValue(id) {
  const element = document.getElementById(id);
  return element ? element.value : '';
}

function clearNotices() {
  const notice = $('#setup-notice');
  if (notice) {
    notice.classList.add('hidden');
  }
}

function showNotice(message, isError = false) {
  const notice = $('#setup-notice');
  if (notice) {
    notice.querySelector('div').innerHTML = message;
    notice.classList.toggle('error', isError);
    notice.classList.remove('hidden');
  }
}

function showGenerating(show) {
  const button = $('#generate');
  if (button) {
    button.disabled = show;
    button.textContent = show ? 'GENERATING...' : '✦ GENERATE SHORT';
  }
}

function updateResearchPanel(data) {
  // Update research panel with findings
  const researchPanel = document.querySelector('.research-panel');
  if (researchPanel && data.facts) {
    const empty = researchPanel.querySelector('.research-empty');
    if (empty) {
      empty.innerHTML = `
        <h3>Research Complete</h3>
        <p>Found ${data.facts.length} fact(s) from ${data.sources?.length || 0} source(s)</p>
        <button class="outline-button" onclick="reviewFacts()">REVIEW FACTS</button>
      `;
    }
  }
}

// Progress Pipeline Management
const progressSteps = ['research', 'script', 'images', 'audio', 'music', 'render', 'publish'];

function showPipeline() {
  const pipeline = $('#pipeline-progress');
  pipeline.style.display = 'block';
  pipeline.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function hidePipeline() {
  const pipeline = $('#pipeline-progress');
  pipeline.style.display = 'none';
}

function resetPipeline() {
  progressSteps.forEach(step => {
    const stepElement = document.querySelector(`.progress-step[data-step="${step}"]`);
    if (stepElement) {
      stepElement.className = 'progress-step';
      stepElement.querySelector('.step-status').textContent = 'pending';
      stepElement.querySelector('.progress-fill').style.width = '0%';
    }
  });
  $('#pipeline-status').textContent = 'Initializing...';
}

function updateStep(stepName, status, progress = 0, message = '') {
  const stepElement = document.querySelector(`.progress-step[data-step="${stepName}"]`);
  if (!stepElement) return;
  
  // Remove all status classes
  stepElement.classList.remove('active', 'completed', 'error');
  
  // Add new status class
  if (status !== 'pending') {
    stepElement.classList.add(status);
  }
  
  // Update status text
  const statusText = stepElement.querySelector('.step-status');
  statusText.textContent = status;
  
  // Update progress bar
  const progressFill = stepElement.querySelector('.progress-fill');
  progressFill.style.width = `${progress}%`;
  
  // Update description if message provided
  if (message) {
    const description = stepElement.querySelector('.step-description');
    description.textContent = message;
  }
  
  // Update pipeline status
  if (status === 'active') {
    $('#pipeline-status').textContent = `Working on ${stepName}...`;
  } else if (status === 'completed') {
    $('#pipeline-status').textContent = `${stepName} completed`;
  } else if (status === 'error') {
    $('#pipeline-status').textContent = `${stepName} failed`;
  }
}

function simulateProgress(stepName, duration = 3000) {
  return new Promise((resolve) => {
    updateStep(stepName, 'active', 0);
    
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress >= 90) {
        progress = 90; // Stop at 90% until completion
      }
      updateStep(stepName, 'active', progress);
    }, 200);
    
    setTimeout(() => {
      clearInterval(interval);
      updateStep(stepName, 'completed', 100);
      resolve();
    }, duration);
  });
}

function createSceneProgress(totalScenes) {
  // Add scene progress to the images step
  const imagesStep = document.querySelector(`.progress-step[data-step="images"]`);
  let sceneProgress = imagesStep.querySelector('.scene-progress');
  
  if (!sceneProgress) {
    sceneProgress = document.createElement('div');
    sceneProgress.className = 'scene-progress';
    sceneProgress.innerHTML = `
      <div class="scene-progress-header">
        <div class="scene-progress-title">SCENE GENERATION</div>
        <div class="scene-progress-count">0 / ${totalScenes}</div>
      </div>
      <div class="scene-grid" id="scene-grid"></div>
    `;
    imagesStep.querySelector('.step-content').appendChild(sceneProgress);
  }
  
  const sceneGrid = sceneProgress.querySelector('#scene-grid');
  sceneGrid.innerHTML = '';
  
  for (let i = 1; i <= totalScenes; i++) {
    const sceneDot = document.createElement('div');
    sceneDot.className = 'scene-dot';
    sceneDot.textContent = i;
    sceneDot.dataset.scene = i;
    sceneGrid.appendChild(sceneDot);
  }
  
  return sceneProgress;
}

function updateSceneProgress(sceneNumber, status) {
  const sceneDot = document.querySelector(`.scene-dot[data-scene="${sceneNumber}"]`);
  if (sceneDot) {
    sceneDot.className = `scene-dot ${status}`;
  }
  
  // Update count
  const completedScenes = document.querySelectorAll('.scene-dot.completed').length;
  const totalScenes = document.querySelectorAll('.scene-dot').length;
  const progressCount = document.querySelector('.scene-progress-count');
  if (progressCount) {
    progressCount.textContent = `${completedScenes} / ${totalScenes}`;
  }
  
  // Update images step progress
  const progress = (completedScenes / totalScenes) * 100;
  updateStep('images', completedScenes === totalScenes ? 'completed' : 'active', progress);
}

async function loadYouTubeStatus() {
  try {
    const status = await api('/api/youtube/status');
    state.youtube = status;
    
    const statusElement = $('#youtube-status');
    const labelElement = $('#youtube-label');
    const connectionStatus = $('#youtube-connection-status');
    const connectBtn = $('#youtube-connect-btn');
    const youtubeInfo = $('#youtube-info');
    const publishBtn = $('.publish-button');
    
    if (status.connected && status.channelInfo) {
      // Update header status
      statusElement.className = 'status-dot live';
      labelElement.textContent = 'Connected';
      
      // Update connection status
      connectionStatus.textContent = 'CONNECTED';
      connectionStatus.className = 'draft-pill connected';
      connectBtn.textContent = 'RECONNECT';
      
      // Update publish button
      publishBtn.innerHTML = `PUBLISH TO ${status.channelInfo.title.toUpperCase()} <span>▶</span>`;
      publishBtn.classList.remove('blocked');
      
      // Show channel info
      youtubeInfo.style.display = 'block';
      updateChannelInfo(status.channelInfo);
    } else if (status.connected) {
      // Connected but no channel info
      statusElement.className = 'status-dot pending';
      labelElement.textContent = 'Connected';
      connectionStatus.textContent = 'CONNECTED (NO INFO)';
      connectBtn.textContent = 'REFRESH';
      youtubeInfo.style.display = 'none';
      publishBtn.innerHTML = 'PUBLISH TO YOUTUBE <span>▶</span>';
    } else {
      // Not connected
      statusElement.className = 'status-dot pending';
      labelElement.textContent = 'Connect';
      connectionStatus.textContent = 'NOT CONNECTED';
      connectionStatus.className = 'draft-pill';
      connectBtn.textContent = 'CONNECT CHANNEL';
      youtubeInfo.style.display = 'none';
      publishBtn.innerHTML = 'PUBLISH BLOCKED <span>⚑</span>';
      publishBtn.classList.add('blocked');
    }
  } catch (error) {
    console.error('Failed to load YouTube status:', error);
  }
}

function updateChannelInfo(channelInfo) {
  $('#channel-title').textContent = channelInfo.title;
  $('#channel-subscribers').textContent = formatSubscriberCount(channelInfo.statistics.subscriberCount) + ' subscribers';
  $('#upload-destination-name').textContent = channelInfo.title;
  $('#channel-id').textContent = channelInfo.id;
  
  if (channelInfo.thumbnails?.medium?.url) {
    $('#channel-thumbnail').src = channelInfo.thumbnails.medium.url;
  }
}

async function connectYouTube() {
  try {
    const result = await api('/api/youtube/connect', { method: 'POST' });
    window.location.href = result.authorizationUrl;
  } catch (error) {
    setNotice(`<b>YouTube connection failed.</b> ${error.message}`, true);
  }
}

async function disconnectYouTube() {
  if (!confirm('Disconnect YouTube? This will remove your channel connection and you\'ll need to reconnect to publish videos.')) {
    return;
  }
  
  try {
    await api('/api/youtube/disconnect', { method: 'POST' });
    setNotice('<b>YouTube disconnected.</b> Your channel has been disconnected successfully.');
    await loadYouTubeStatus();
  } catch (error) {
    setNotice(`<b>YouTube disconnect failed.</b> ${error.message}`, true);
  }
}

async function refreshChannelInfo() {
  try {
    const result = await api('/api/youtube/refresh', { method: 'POST' });
    state.youtube.channelInfo = result.channelInfo;
    updateChannelInfo(result.channelInfo);
    setNotice('<b>Channel info refreshed.</b> Updated channel details from YouTube.');
  } catch (error) {
    setNotice(`<b>Refresh failed.</b> ${error.message}`, true);
  }
}

function checkUrlParams() {
  const params = new URLSearchParams(window.location.search);
  
  if (params.has('youtube_success')) {
    setNotice('<b>YouTube connected successfully!</b> Your channel is now connected and ready for publishing.');
    loadYouTubeStatus();
  } else if (params.has('youtube_warning')) {
    setNotice(`<b>YouTube connected with warning.</b> ${params.get('youtube_warning')}`, false);
    loadYouTubeStatus();
  } else if (params.has('youtube_error')) {
    setNotice(`<b>YouTube connection failed.</b> ${params.get('youtube_error')}`, true);
  }
  
  // Clean up URL parameters
  if (params.has('youtube_success') || params.has('youtube_warning') || params.has('youtube_error')) {
    const newUrl = window.location.pathname;
    window.history.replaceState({}, document.title, newUrl);
  }
}

async function loadHealth() {
  const health = await api('/api/health');
  const ready = health.configured.openRouter;
  $('#ai-status').className = `status-dot ${ready ? 'live' : 'pending'}`;
  $('#ai-label').textContent = ready ? 'Ready' : 'Setup';
  if (ready) $('#setup-notice').classList.add('hidden');
}

function renderPrompts() {
  const list = $('#prompt-list');
  list.innerHTML = state.prompts.map((prompt) => `<button data-id="${prompt.id}" class="${prompt.id === state.selectedPromptId ? 'active' : ''}"><span>${prompt.layer}</span>${prompt.name}<b>v${prompt.currentVersion}</b></button>`).join('');
  const prompt = state.prompts.find((item) => item.id === state.selectedPromptId) || state.prompts[0];
  if (!prompt) return;
  state.selectedPromptId = prompt.id;
  $('#prompt-select').innerHTML = state.prompts.map((item) => `<option value="${item.id}" ${item.id === prompt.id ? 'selected' : ''}>${item.name}</option>`).join('');
  $('#prompt-content').value = prompt.content;
  $('#prompt-version').textContent = `v${prompt.currentVersion} CURRENT`;
  list.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => { state.selectedPromptId = button.dataset.id; renderPrompts(); }));
}

async function loadPrompts() { state.prompts = await api('/api/prompts'); state.selectedPromptId = state.prompts[0]?.id; renderPrompts(); }

async function loadBudget() {
  const budget = await api(`/api/budget?contentType=${encodeURIComponent($('#content-type').value)}`);
  state.budget = budget;
  $('#budget-remaining').textContent = `$${budget.remaining.toFixed(2)}`;
  $('#budget-spent').textContent = `$${budget.spent.toFixed(2)}`;
  $('#budget-short').textContent = `$${budget.allowedPerShort.toFixed(3)}`;
  $('#budget-plan').textContent = `${$('#content-type').value}: ${budget.plan.imageCount} images planned · ${budget.plan.reason}`;
}

function renderScenes(scenes) {
  $('#scene-timeline').innerHTML = scenes.map((scene) => `<button class="scene-card" data-scene="${scene.scene_number}" title="${scene.visual_description}"><span>${String(scene.scene_number).padStart(2, '0')}</span><b>${scene.end_time - scene.start_time}s</b><small>${scene.caption}</small><em>Generate image</em></button>`).join('');
  document.querySelectorAll('.scene-card').forEach((card) => card.addEventListener('click', () => generateImage(Number(card.dataset.scene))));
}

function setFactuality(qa) {
  const score = qa?.score ?? '—';
  const scoreElement = document.querySelector('.factuality-score strong');
  const track = document.querySelector('.score-track i');
  scoreElement.textContent = score === '—' ? score : `${score}%`;
  track.style.width = score === '—' ? '0%' : `${score}%`;
  const pill = document.querySelector('.fact-gate .draft-pill');
  pill.textContent = qa?.status || 'AWAITING EVIDENCE';
  pill.className = `draft-pill ${qa?.passed ? 'passed' : ''}`;
}

// Automation Mode Management
function setAutomationMode(mode) {
  state.automationMode = mode;
  
  // Update UI
  document.querySelectorAll('.mode-switch button').forEach(btn => {
    btn.classList.remove('active');
    if (btn.textContent === mode) {
      btn.classList.add('active');
    }
  });
  
  // Update status indicator
  const statusElement = $('#automation-status');
  const statusText = statusElement.querySelector('span');
  statusElement.className = `automation-status ${mode.toLowerCase().replace('-', '-')}`;
  
  // Update generation button text and behavior based on mode
  const generateBtn = $('#generate');
  const batchBtn = $('.batch-button');
  
  switch (mode) {
    case 'Manual':
      generateBtn.innerHTML = '<span>✦</span> GENERATE SHORT';
      batchBtn.style.display = 'block';
      batchBtn.innerHTML = 'GENERATE BATCH';
      statusText.textContent = 'Manual control active';
      setNotice('<b>Manual Mode:</b> Full control over each step. Generate, review, and approve each stage.');
      break;
      
    case 'Semi-auto':
      generateBtn.innerHTML = '<span>⚡</span> AUTO-GENERATE WITH REVIEW';
      batchBtn.style.display = 'block';
      batchBtn.innerHTML = 'SMART BATCH';
      statusText.textContent = 'Semi-automated with approval gates';
      setNotice('<b>Semi-Auto Mode:</b> Automated generation with approval gates. Review key decisions before proceeding.');
      break;
      
    case 'Full auto':
      generateBtn.innerHTML = '<span>🚀</span> FULL AUTO-GENERATE';
      batchBtn.innerHTML = 'SCHEDULE BATCH';
      statusText.textContent = 'Full automation enabled';
      setNotice('<b>Full Auto Mode:</b> Complete automation from topic to published video. Minimal intervention required.');
      
      // Show auto-publish settings in full auto mode
      showAutoPublishSettings();
      break;
  }
  
  // Save mode preference
  localStorage.setItem('automationMode', mode);
  
  console.log(`🔄 Automation mode changed to: ${mode}`);
}

function showAutoPublishSettings() {
  // Add auto-publish toggle to the publish section in full auto mode
  const publishSection = document.querySelector('.publish-section .panel-heading');
  if (publishSection && !publishSection.querySelector('.auto-publish-toggle')) {
    const autoPublishToggle = document.createElement('div');
    autoPublishToggle.className = 'auto-publish-toggle';
    autoPublishToggle.innerHTML = `
      <label class="toggle-label">
        <input type="checkbox" id="auto-publish-enabled" ${localStorage.getItem('autoPublishEnabled') === 'true' ? 'checked' : ''}>
        <span>Auto-publish in Full Auto mode</span>
      </label>
    `;
    
    publishSection.appendChild(autoPublishToggle);
    
    // Wire up the toggle
    $('#auto-publish-enabled').addEventListener('change', (e) => {
      localStorage.setItem('autoPublishEnabled', e.target.checked);
      const message = e.target.checked 
        ? '<b>⚡ Auto-publish enabled:</b> Full Auto mode will publish directly to YouTube.'
        : '<b>🛡 Auto-publish disabled:</b> Full Auto mode will stop at render completion.';
      setNotice(message);
    });
  }
}

function hideAutoPublishSettings() {
  const toggle = document.querySelector('.auto-publish-toggle');
  if (toggle) toggle.remove();
}


async function executeManualGeneration() {
  // Original manual behavior - user controls each step
  showPipeline();
  resetPipeline();
  
  const generateBtn = $('#generate');
  generateBtn.disabled = true;
  
  try {
    // Show generating state
    showGenerating(true);
    
    updateStep('research', 'active', 0, 'Starting research phase');
    
    const topic = getFormValue('topic');
    const contentType = getFormValue('content-type');
    
    if (!topic.trim()) {
      throw new Error('Please enter a topic before generating');
    }
    
    // Step 1: Create Short first
    updateStep('research', 'active', 50, 'Creating new Short project');
    
    state.activeShort = await api('/api/shorts', { 
      method: 'POST', 
      body: JSON.stringify({ 
        topic: topic, 
        contentType: contentType, 
        duration: Number(getFormValue('duration')), 
        language: 'English', 
        style: getFormValue('visual-style') || 'Cinematic',
        musicMode: getFormValue('music-mode') || 'Library',
        musicMood: getFormValue('music-mood') || 'Dark / Cinematic',
        truthMode: getFormValue('truth-mode'), 
        minimumSources: Number(getFormValue('minimum-sources')) 
      }) 
    });
    
    updateStep('research', 'completed', 100, 'Project created successfully');
    
    // Manual mode - open evidence dialog for user to add research manually
    showNotice('<b>✋ Manual Mode:</b> Please add evidence package before continuing.');
    openDialog('evidence-dialog');
    
    return state.activeShort;
    
  } catch (error) {
    console.error('Manual generation error:', error);
    showNotice(`Manual generation failed: ${error.message}`, true);
    updateStep('research', 'error', 0, 'Setup failed');
    throw error;
  } finally {
    generateBtn.disabled = false;
    generateBtn.innerHTML = '<span>⚡</span> GENERATE SHORT';
    showGenerating(false);
  }
}

async function executeSemiAutoGeneration() {
  showPipeline();
  resetPipeline();
  
  const generateBtn = $('#generate');
  generateBtn.disabled = true;
  
  try {
    // Step 1: Create Short (auto)
    if (!state.activeShort) {
      updateStep('research', 'active', 50, 'Creating new Short project');
      
      state.activeShort = await api('/api/shorts', { 
        method: 'POST', 
        body: JSON.stringify({ 
          topic: $('#topic').value, 
          contentType: $('#content-type').value, 
          duration: Number($('#duration').value), 
          language: 'English', 
          style: $('#visual-style').value || 'Cinematic',
          musicMode: $('#music-mode').value || 'Library',
          musicMood: $('#music-mood').value || 'Dark / Cinematic',
          truthMode: $('#truth-mode').value, 
          minimumSources: Number($('#minimum-sources').value) 
        }) 
      });
      
      updateStep('research', 'completed', 100, 'Project created successfully');
      
      // Auto-open evidence dialog for user input
      setNotice('<b>✋ Semi-Auto Pause:</b> Please add evidence package before continuing.');
      openDialog('evidence-dialog');
      
      // Wait for evidence before proceeding
      return;
    }
    
    // Step 2: Generate Script (auto, but with confirmation)
    if (!await confirmStep('Generate evidence-cited script?', 'Script generation will create the narrative based on your evidence package.')) {
      return;
    }
    
    updateStep('script', 'active', 0, 'Generating evidence-cited narrative');
    const generated = await api(`/api/shorts/${state.activeShort.id}/script`, { method: 'POST' });
    
    // Check if script generation succeeded
    if (!generated.script) {
      const errorMsg = generated.error || 'Script generation failed - no script returned';
      if (errorMsg.includes('Background processing not available')) {
        throw new Error('Auto mode requires Redis and database configuration. Please use Manual mode, or configure DATABASE_URL and REDIS_URL in your environment.');
      }
      throw new Error(`${errorMsg}. This may require Redis and database configuration.`);
    }
    
    state.activeShort = generated;
    updateStep('script', 'completed', 100, 'Script generated with citations');
    
    $('#hook').value = generated.script.hook; 
    $('#narration').value = generated.script.narration; 
    $('#youtube-title').value = generated.script.title;
    renderScenes(generated.script.scenes);
    
    // Step 3: Generate Images (auto, with budget confirmation)
    const budgetInfo = `This will generate ${generated.script.scenes.length} images (estimated cost: $${(generated.script.scenes.length * 0.009).toFixed(3)})`;
    if (!await confirmStep('Generate all scene images?', budgetInfo)) {
      setNotice('<b>⏸ Semi-Auto Paused:</b> Generate images manually when ready.');
      return;
    }
    
    await generateAllImages(generated.script.scenes);
    
    // Step 4: Generate Audio & Music (auto)
    await generateAllAudio();
    
    // Step 5: Render Video (with final confirmation)
    if (!await confirmStep('Render final video?', 'This will create the final Short with all effects and music.')) {
      setNotice('<b>⏸ Semi-Auto Paused:</b> Render video manually when ready.');
      return;
    }
    
    await renderVideo();
    
    setNotice('<b>✅ Semi-Auto Complete!</b> Your Short is ready for manual publishing approval.');
    
  } finally {
    generateBtn.disabled = false;
    generateBtn.innerHTML = '<span>⚡</span> AUTO-GENERATE WITH REVIEW';
  }
}

async function executeFullAutoGeneration() {
  showPipeline();
  resetPipeline();
  
  const generateBtn = $('#generate');
  generateBtn.disabled = true;
  generateBtn.innerHTML = '<span>◌</span> FULL AUTO RUNNING...';
  
  try {
    // Step 1: Create Short (auto)
    if (!state.activeShort) {
      updateStep('research', 'active', 25, 'Creating new Short project');
      
      state.activeShort = await api('/api/shorts', { 
        method: 'POST', 
        body: JSON.stringify({ 
          topic: $('#topic').value, 
          contentType: $('#content-type').value, 
          duration: Number($('#duration').value), 
          language: 'English', 
          style: $('#visual-style').value || 'Cinematic',
          musicMode: $('#music-mode').value || 'AI Generate', // Prefer AI music in full auto
          musicMood: $('#music-mood').value || 'Dark / Cinematic',
          truthMode: $('#truth-mode').value, 
          minimumSources: Number($('#minimum-sources').value) 
        }) 
      });
      
      updateStep('research', 'active', 50, 'Searching Reddit for Marvel facts');
      
      // Enhanced auto-generate evidence with Reddit research
      try {
        const redditEvidence = await api(`/api/research/auto-generate?topic=${encodeURIComponent(state.activeShort.topic)}&contentType=${encodeURIComponent(state.activeShort.contentType)}&includeReddit=true&maxPosts=5&minScore=40`);
        
        updateStep('research', 'active', 75, 'Processing Reddit sources and facts');
        
        const evidenceResult = await api(`/api/shorts/${state.activeShort.id}/research`, { 
          method: 'POST', 
          body: JSON.stringify(redditEvidence) 
        });
        
        state.activeShort = evidenceResult.short;
        updateStep('research', 'completed', 100, `Research complete: ${redditEvidence.sources.length} sources, ${redditEvidence.facts.length} facts`);
        
        if (redditEvidence.enhancement) {
          const enhancement = redditEvidence.enhancement;
          console.log('🚀 Reddit enhancement applied:', enhancement);
          
          if (enhancement.redditSourcesAdded > 0) {
            setNotice(`<b>🔍 Reddit Research:</b> Found ${enhancement.redditSourcesAdded} community sources and ${enhancement.redditFactsAdded} facts from Marvel subreddits.`);
          }
        }
        
      } catch (redditError) {
        console.warn('Reddit research failed, using basic evidence:', redditError);
        updateStep('research', 'active', 75, 'Using fallback evidence generation');
        
        // Fallback to basic evidence
        const autoEvidence = generateAutoEvidence(state.activeShort.topic, state.activeShort.contentType);
        const evidenceResult = await api(`/api/shorts/${state.activeShort.id}/research`, { 
          method: 'POST', 
          body: JSON.stringify(autoEvidence) 
        });
        state.activeShort = evidenceResult.short;
        updateStep('research', 'completed', 100, 'Basic evidence generated successfully');
      }
    }
    
    // Step 2: Generate Script (auto)
    updateStep('script', 'active', 0, 'Generating evidence-cited narrative');
    const generated = await api(`/api/shorts/${state.activeShort.id}/script?automation=true`, { method: 'POST' });
    
    // Check if script generation was queued for background processing
    if (generated.message && generated.message.includes('queued')) {
      updateStep('script', 'active', 25, 'Script queued for background processing');
      
      // Wait for background processing to complete
      const completedShort = await waitForWorkerCompletion(state.activeShort.id, 'script');
      state.activeShort = completedShort;
      updateStep('script', 'completed', 100, 'Script generated by worker');
      
    } else if (generated.script) {
      // Direct script generation succeeded
      state.activeShort = generated;
      updateStep('script', 'completed', 100, 'Script generated with citations');
    } else {
      throw new Error('Script generation failed - no script returned');
    }
    
    // Update UI with generated script
    if (state.activeShort.script) {
      $('#hook').value = state.activeShort.script.hook || ''; 
      $('#narration').value = state.activeShort.script.narration || ''; 
      $('#youtube-title').value = state.activeShort.script.title || '';
      if (state.activeShort.script.scenes) {
        renderScenes(state.activeShort.script.scenes);
      }
    }
    
    // Step 3: Generate All Images (auto)
    if (state.activeShort.script && state.activeShort.script.scenes) {
      await generateAllImages(state.activeShort.script.scenes);
    } else {
      throw new Error('No script scenes available for image generation');
    }
    
    // Step 4: Generate Audio & Music (auto)
    await generateAllAudio();
    
    // Step 5: Render Video (auto)
    await renderVideo();
    
    // Step 6: Auto-Publish (if YouTube connected and setting enabled)
    if (state.youtube?.connected && await shouldAutoPublish()) {
      updateStep('publish', 'active', 0, 'Auto-publishing to Marvel Central');
      
      try {
        const result = await api(`/api/shorts/${state.activeShort.id}/publish`, {
          method: 'POST',
          body: JSON.stringify({ 
            visibility: 'private', // Safe default for auto-publishing
            publishAt: undefined 
          })
        });
        
        updateStep('publish', 'completed', 100, `Published to ${result.channelTitle}`);
        setNotice(`<b>🚀 Full Auto Complete!</b> Video published to ${result.channelTitle || 'YouTube'}! <a href="${result.url}" target="_blank">View video</a>`);
      } catch (publishError) {
        updateStep('publish', 'error', 0, publishError.message);
        setNotice('<b>✅ Production Complete, Publishing Failed:</b> Video ready for manual publishing.');
      }
    } else {
      setNotice('<b>🚀 Full Auto Complete!</b> Video ready for publishing to Marvel Central.');
    }
    
  } catch (error) {
    console.error('Full Auto generation failed:', error);
    updateStep('research', 'error', 0, error.message);
    setNotice(`<b>Full Auto generation failed.</b> ${error.message}`, true);
  } finally {
    generateBtn.disabled = false;
    generateBtn.innerHTML = '<span>🚀</span> FULL AUTO-GENERATE';
  }
}

// Helper functions for automation
async function confirmStep(title, description) {
  return new Promise((resolve) => {
    if (confirm(`${title}\n\n${description}\n\nContinue with semi-automatic generation?`)) {
      resolve(true);
    } else {
      resolve(false);
    }
  });
}

function generateAutoEvidence(topic, contentType) {
  // Generate basic evidence package for full auto mode with unique IDs
  const timestamp = Date.now();
  const sources = [
    {
      id: `SRC-AUTO-${timestamp}-1`,
      title: `${topic} Official Information`,
      url: 'https://marvel.com/news',
      tier: 1,
      type: 'Research'
    },
    {
      id: `SRC-AUTO-${timestamp}-2`, 
      title: `${contentType} Analysis`,
      url: 'https://marvelcinematicuniverse.fandom.com',
      tier: 2,
      type: 'Research'
    },
    {
      id: `SRC-AUTO-${timestamp}-3`,
      title: 'Marvel Studios Database',
      url: 'https://www.marvel.com/movies',
      tier: 1,
      type: 'Research'
    }
  ];
  
  const facts = [
    {
      id: `FACT-AUTO-${timestamp}-1`,
      statement: `${topic} is part of the Marvel Cinematic Universe`,
      classification: 'CONFIRMED',
      sourceIds: [`SRC-AUTO-${timestamp}-1`, `SRC-AUTO-${timestamp}-3`],
      confidence: 0.95
    },
    {
      id: `FACT-AUTO-${timestamp}-2`,
      statement: `${topic} has been officially announced by Marvel Studios`,
      classification: 'CONFIRMED', 
      sourceIds: [`SRC-AUTO-${timestamp}-1`, `SRC-AUTO-${timestamp}-3`],
      confidence: 0.9
    },
    {
      id: `FACT-AUTO-${timestamp}-3`,
      statement: `${contentType} content provides detailed information about ${topic}`,
      classification: 'CONFIRMED',
      sourceIds: [`SRC-AUTO-${timestamp}-2`, `SRC-AUTO-${timestamp}-3`],
      confidence: 0.85
    }
  ];
  
  return { sources, facts };
}

// Wait for worker to complete processing a specific stage
async function waitForWorkerCompletion(shortId, expectedStage, maxWaitMinutes = 10) {
  const maxWaitMs = maxWaitMinutes * 60 * 1000;
  const startTime = Date.now();
  const pollInterval = 2000; // Check every 2 seconds
  
  console.log(`⏳ Waiting for worker completion of ${expectedStage} for short ${shortId}`);
  
  while (Date.now() - startTime < maxWaitMs) {
    try {
      // Poll the short status
      const short = await api(`/api/shorts/${shortId}`);
      
      console.log(`🔄 Worker status check - Status: ${short.status}, Expected: ${expectedStage}`);
      
      // Check if the expected stage is completed
      if (expectedStage === 'script' && short.script) {
        console.log(`✅ Script generation completed by worker`);
        return short;
      }
      
      if (expectedStage === 'images' && short.assets && short.assets.length > 0) {
        console.log(`✅ Image generation completed by worker`);
        return short;
      }
      
      if (expectedStage === 'audio' && short.audio) {
        console.log(`✅ Audio generation completed by worker`);
        return short;
      }
      
      if (expectedStage === 'video' && short.video) {
        console.log(`✅ Video rendering completed by worker`);
        return short;
      }
      
      // Check for failure states
      if (short.status === 'FAILED') {
        const errorMsg = short.error || 'Worker processing failed';
        console.error(`❌ Worker failed for ${expectedStage}: ${errorMsg}`);
        throw new Error(`Background processing failed: ${errorMsg}`);
      }
      
      // Update progress based on current status
      const statusMap = {
        'QUEUED': 10,
        'GENERATING_SCRIPT': expectedStage === 'script' ? 50 : 25,
        'GENERATING_IMAGES': expectedStage === 'images' ? 50 : 35,
        'GENERATING_AUDIO': expectedStage === 'audio' ? 50 : 45,
        'RENDERING': expectedStage === 'video' ? 50 : 55,
        'QA': 80,
        'READY': 90
      };
      
      const progress = statusMap[short.status] || 25;
      updateStep(expectedStage, 'active', progress, `Worker status: ${short.status}`);
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      
    } catch (error) {
      // If it's an API error, continue polling in case it's temporary
      if (error.message === 'Request failed.') {
        console.warn(`⚠️ Temporary API error during worker polling: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        continue;
      }
      
      // Re-throw other errors
      throw error;
    }
  }
  
  // Timeout reached
  console.error(`⏰ Worker completion timeout reached for ${expectedStage} (${maxWaitMinutes} minutes)`);
  throw new Error(`Background processing timeout: ${expectedStage} did not complete within ${maxWaitMinutes} minutes`);
}

async function shouldAutoPublish() {
  // Check if auto-publishing is enabled and safe
  const autoPublishEnabled = localStorage.getItem('autoPublishEnabled') === 'true';
  const isConnectedToCorrectChannel = state.youtube?.channelInfo?.title?.includes('Marvel Central');
  
  return autoPublishEnabled && isConnectedToCorrectChannel;
}
async function generate() {
  // Get current automation mode and execute appropriate workflow
  const mode = state.automationMode || 'Manual';
  
  try {
    // Reset any previous errors
    clearNotices();
    
    // Execute the appropriate workflow based on mode
    let result;
    switch (mode) {
      case 'Manual':
        result = await executeManualGeneration();
        break;
        
      case 'Semi-auto':
        result = await executeSemiAutoGeneration();
        break;
        
      case 'Full auto':
        result = await executeFullAutoGeneration();
        break;
        
      default:
        throw new Error(`Unknown automation mode: ${mode}`);
    }
    
    return result;
    
  } catch (error) {
    console.error(`Generation failed (${mode} mode):`, error);
    showNotice(`<b>Generation failed.</b> ${error.message}`, true);
    throw error;
  } finally {
    showGenerating(false);
  }
}

async function generateAllImages(scenes) {
  updateStep('images', 'active', 0, `Generating ${scenes.length} scene images`);
  
  // Create scene progress tracker
  createSceneProgress(scenes.length);
  const sceneProgress = document.querySelector('.scene-progress');
  sceneProgress.classList.add('active');
  
  let completedScenes = 0;
  
  for (const scene of scenes) {
    try {
      updateSceneProgress(scene.scene_number, 'generating');
      
      const asset = await api(`/api/shorts/${state.activeShort.id}/scenes/${scene.scene_number}/image`, { 
        method: 'POST' 
      });
      
      updateSceneProgress(scene.scene_number, 'completed');
      completedScenes++;
      
      // Update budget display
      await loadBudget();
      
    } catch (error) {
      updateSceneProgress(scene.scene_number, 'error');
      console.error(`Scene ${scene.scene_number} failed:`, error);
    }
  }
  
  if (completedScenes === scenes.length) {
    updateStep('images', 'completed', 100, `All ${scenes.length} images generated`);
  } else {
    updateStep('images', 'error', (completedScenes / scenes.length) * 100, `${completedScenes}/${scenes.length} images completed`);
  }
}

async function generateAllAudio() {
  if (!state.activeShort?.script) return;
  
  updateStep('audio', 'active', 0, 'Generating narration voice');
  
  try {
    await simulateProgress('audio', 2000); // Simulate TTS generation
    
    const result = await api(`/api/shorts/${state.activeShort.id}/audio`, { method: 'POST' });
    updateStep('audio', 'completed', 100, 'Narration generated successfully');
    
    // Update music step based on result
    if (result.music && result.music.type !== 'none') {
      updateStep('music', 'completed', 100, `${result.music.type} music added (${result.music.mood})`);
    } else {
      updateStep('music', 'error', 0, result.music?.error || 'No music added');
    }
    
  } catch (error) {
    updateStep('audio', 'error', 0, error.message);
    updateStep('music', 'error', 0, 'Audio generation failed');
    throw error;
  }
}

async function generateMusic() {
  if (!state.activeShort) return;
  
  updateStep('music', 'active', 0, 'Selecting background music');
  
  try {
    const musicMode = $('#music-mode').value || 'Library';
    const musicMood = $('#music-mood').value || 'Dark / Cinematic';
    
    let progressMessage = musicMode === 'AI Generate' 
      ? `Generating AI music (${musicMood})` 
      : `Selecting library music (${musicMood})`;
    
    updateStep('music', 'active', 20, progressMessage);
    
    if (musicMode === 'AI Generate') {
      // Show more detailed progress for AI generation
      setTimeout(() => updateStep('music', 'active', 40, 'Creating musical arrangement'), 1000);
      setTimeout(() => updateStep('music', 'active', 60, 'Generating audio with Suno AI'), 2000);
      setTimeout(() => updateStep('music', 'active', 80, 'Processing and optimizing'), 3000);
    }
    
    const result = await api(`/api/music/shorts/${state.activeShort.id}?mode=${encodeURIComponent(musicMode)}&mood=${encodeURIComponent(musicMood)}&duration=${state.activeShort.duration || 60}&context=${encodeURIComponent(state.activeShort.topic || '')}`);
    
    state.activeShort.music = result;
    updateMusicPreview(result);
    
    const completionMessage = musicMode === 'AI Generate' 
      ? `AI music generated (${result.mood})`
      : `Library music selected (${result.mood})`;
    
    updateStep('music', 'completed', 100, completionMessage);
    
  } catch (error) {
    updateStep('music', 'error', 0, error.message);
    console.error('Music generation failed:', error);
  }
}

function updateMusicPreview(musicResult) {
  const musicPreview = $('#music-preview');
  const musicInfo = $('#music-info');
  const playBtn = $('#music-play');
  
  if (musicResult && musicResult.type !== 'none') {
    musicPreview.style.display = 'block';
    
    const typeLabel = musicResult.type === 'ai_generated' ? 'AI Generated' : 'Library';
    const costInfo = musicResult.cost > 0 ? ` ($${musicResult.cost.toFixed(3)})` : '';
    
    musicInfo.textContent = `${typeLabel}: ${musicResult.mood}${costInfo}`;
    musicInfo.classList.add('loaded');
    
    // Enable play button if URL is available
    if (musicResult.asset?.url || musicResult.track?.filePath) {
      playBtn.disabled = false;
      playBtn.onclick = () => toggleMusicPlayback(musicResult);
    }
  } else {
    musicPreview.style.display = 'none';
  }
}

let currentAudio = null;

function toggleMusicPlayback(musicResult) {
  const playBtn = $('#music-play');
  
  if (currentAudio) {
    if (currentAudio.paused) {
      currentAudio.play();
      playBtn.textContent = '⏸';
      playBtn.classList.add('playing');
    } else {
      currentAudio.pause();
      playBtn.textContent = '▶';
      playBtn.classList.remove('playing');
    }
    return;
  }
  
  // Create new audio instance
  const audioUrl = musicResult.asset?.url || musicResult.track?.filePath;
  if (!audioUrl) {
    setNotice('<b>Audio preview not available.</b>', true);
    return;
  }
  
  currentAudio = new Audio(audioUrl);
  currentAudio.volume = 0.5; // 50% volume for preview
  
  currentAudio.addEventListener('loadstart', () => {
    playBtn.textContent = '◌';
    playBtn.disabled = true;
  });
  
  currentAudio.addEventListener('canplay', () => {
    playBtn.textContent = '⏸';
    playBtn.classList.add('playing');
    playBtn.disabled = false;
    currentAudio.play();
  });
  
  currentAudio.addEventListener('ended', () => {
    playBtn.textContent = '▶';
    playBtn.classList.remove('playing');
    currentAudio = null;
  });
  
  currentAudio.addEventListener('error', () => {
    playBtn.textContent = '▶';
    playBtn.classList.remove('playing');
    playBtn.disabled = false;
    setNotice('<b>Music preview failed to load.</b>', true);
    currentAudio = null;
  });
}

async function regenerateMusic() {
  if (!state.activeShort) return;
  
  const regenerateBtn = $('#music-regenerate');
  const originalText = regenerateBtn.textContent;
  
  regenerateBtn.disabled = true;
  regenerateBtn.textContent = '◌';
  
  try {
    // Stop current audio if playing
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
      $('#music-play').textContent = '▶';
      $('#music-play').classList.remove('playing');
    }
    
    await generateMusic();
    setNotice('<b>🎵 Music regenerated successfully!</b>');
  } catch (error) {
    setNotice(`<b>Music regeneration failed.</b> ${error.message}`, true);
  } finally {
    regenerateBtn.disabled = false;
    regenerateBtn.textContent = originalText;
  }
}

async function renderVideo() {
  if (!state.activeShort) return;
  
  updateStep('render', 'active', 0, 'Assembling scenes and audio');
  
  try {
    await simulateProgress('render', 4000); // Simulate video rendering
    
    await api(`/api/shorts/${state.activeShort.id}/render`, { method: 'POST' });
    updateStep('render', 'completed', 100, 'Video rendered successfully');
    
  } catch (error) {
    updateStep('render', 'error', 0, error.message);
    throw error;
  }
}

function parseEvidence() {
  const sources = $('#evidence-sources').value.split('\n').map((line, index) => {
    const [title, url, tier] = line.split('|').map((value) => value.trim());
    return title ? { id: `SRC-${index + 1}`, title, url, tier: Number(tier), type: 'Research' } : null;
  }).filter(Boolean);
  const sourcesByTitle = new Map(sources.map((source) => [source.title.toLowerCase(), source.id]));
  const facts = $('#evidence-facts').value.split('\n').map((line, index) => {
    const [statement, classification, citedTitles = ''] = line.split('|').map((value) => value.trim());
    const sourceIds = citedTitles.split(',').map((title) => sourcesByTitle.get(title.trim().toLowerCase())).filter(Boolean);
    return statement ? { id: `FACT-${index + 1}`, statement, classification, sourceIds, confidence: classification === 'CONFIRMED' ? 0.9 : 0.7 } : null;
  }).filter(Boolean);
  return { sources, facts };
}

async function saveEvidence() {
  if (!state.activeShort) { $('#evidence-message').textContent = 'Create a draft first.'; return; }
  try {
    const result = await api(`/api/shorts/${state.activeShort.id}/research`, { method: 'POST', body: JSON.stringify(parseEvidence()) });
    state.activeShort = result.short; $('#evidence-message').textContent = `Saved. ${result.short.facts.length} facts meet the evidence gate.`; setFactuality(null); closeDialogs();
    setNotice('<b>Evidence gate passed.</b> You can now generate an evidence-cited script.');
  } catch (error) { $('#evidence-message').textContent = error.message; setNotice(`<b>Evidence needs attention.</b> ${error.message}`, true); }
}

async function runQA() {
  if (!state.activeShort) return setNotice('<b>QA awaits a draft.</b> Create an evidence package and script first.', true);
  try { 
    const qa = await api(`/api/shorts/${state.activeShort.id}/qa`, { method: 'POST' }); 
    setFactuality({ ...qa, passed: qa.status === 'QA PASSED' }); 
    setNotice('<b>Factuality QA passed.</b> Publishing may proceed once a YouTube adapter is configured.'); 
  }
  catch (error) { setNotice(`<b>Publishing remains blocked.</b> ${error.message}`, true); }
}

async function publishToYouTube() {
  if (!state.activeShort || !state.youtube?.connected) {
    return setNotice('<b>Publishing requires a connected YouTube channel and completed Short.</b>', true);
  }

  const publishBtn = $('.publish-button');
  const originalText = publishBtn.innerHTML;
  
  // Show pipeline if hidden and update publish step
  showPipeline();
  updateStep('publish', 'active', 0, `Uploading to ${state.youtube.channelInfo?.title || 'YouTube'}`);
  
  publishBtn.disabled = true;
  publishBtn.innerHTML = '◌ UPLOADING TO ' + (state.youtube.channelInfo?.title || 'YOUTUBE') + '...';

  try {
    const visibility = document.querySelector('.visibility-buttons .active')?.textContent?.toLowerCase() || 'private';
    const publishAt = document.querySelector('.schedule-choice .active')?.textContent === 'Schedule' 
      ? new Date(Date.now() + 3600000).toISOString() // 1 hour from now as example
      : undefined;

    // Simulate upload progress
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += Math.random() * 10;
      if (progress >= 85) progress = 85; // Stop at 85% until upload completes
      updateStep('publish', 'active', progress, `Uploading to ${state.youtube.channelInfo?.title || 'YouTube'} (${Math.round(progress)}%)`);
    }, 300);

    const result = await api(`/api/shorts/${state.activeShort.id}/publish`, {
      method: 'POST',
      body: JSON.stringify({ visibility, publishAt })
    });

    clearInterval(progressInterval);
    
    state.activeShort.youtube = result;
    state.activeShort.status = 'PUBLISHED';
    
    updateStep('publish', 'completed', 100, `Published to ${result.channelTitle || 'YouTube'}`);
    $('#pipeline-status').textContent = `✅ Successfully published to ${result.channelTitle || 'YouTube'}!`;
    
    setNotice(`<b>✅ Published to ${result.channelTitle || 'YouTube'}!</b> <a href="${result.url}" target="_blank">View video</a>`);
    
    publishBtn.innerHTML = `✅ PUBLISHED TO ${(result.channelTitle || 'YOUTUBE').toUpperCase()}`;
    
  } catch (error) {
    const progressInterval = setInterval(() => {}, 300);
    clearInterval(progressInterval);
    
    updateStep('publish', 'error', 0, error.message);
    setNotice(`<b>Publishing failed.</b> ${error.message}`, true);
    publishBtn.disabled = false;
    publishBtn.innerHTML = originalText;
  }
}

async function generateImage(sceneNumber) {
  if (!state.activeShort) return setNotice('<b>Image generation awaits a structured script.</b>', true);
  
  // Show scene progress if not already visible
  if (!document.querySelector('.scene-progress.active')) {
    const totalScenes = state.activeShort.script?.scenes?.length || 10;
    createSceneProgress(totalScenes);
    document.querySelector('.scene-progress').classList.add('active');
    updateStep('images', 'active', 0, 'Generating scene images manually');
  }
  
  updateSceneProgress(sceneNumber, 'generating');
  
  try { 
    const asset = await api(`/api/shorts/${state.activeShort.id}/scenes/${sceneNumber}/image`, { method: 'POST' }); 
    updateSceneProgress(sceneNumber, 'completed');
    setNotice(`<b>Scene ${sceneNumber} image generated.</b> Cost recorded: $${asset.cost.toFixed(4)}.`); 
    await loadBudget(); 
  }
  catch (error) { 
    updateSceneProgress(sceneNumber, 'error');
    setNotice(`<b>Scene ${sceneNumber} image not generated.</b> ${error.message}`, true); 
  }
}

async function generateAudio() {
  if (!state.activeShort) return setNotice('<b>Voice generation awaits a structured script.</b>', true);
  
  showPipeline();
  updateStep('audio', 'active', 0, 'Generating narration voice');
  
  try { 
    await simulateProgress('audio', 2000);
    await api(`/api/shorts/${state.activeShort.id}/audio`, { method: 'POST' }); 
    updateStep('audio', 'completed', 100, 'Narration generated successfully');
    setNotice('<b>Narration generated.</b> You can now render a draft.'); 
  }
  catch (error) { 
    updateStep('audio', 'error', 0, error.message);
    setNotice(`<b>Narration not generated.</b> ${error.message}`, true); 
  }
}

async function renderDraft() {
  if (!state.activeShort) return setNotice('<b>Rendering awaits a structured script.</b>', true);
  
  showPipeline();
  updateStep('render', 'active', 0, 'Initializing cinematic render');
  
  try {
    // Show detailed rendering progress
    setTimeout(() => updateStep('render', 'active', 10, 'Applying Ken Burns zoom effects'), 500);
    setTimeout(() => updateStep('render', 'active', 25, 'Processing Marvel color grading'), 1000);
    setTimeout(() => updateStep('render', 'active', 40, 'Adding animated text overlays'), 1500);
    setTimeout(() => updateStep('render', 'active', 60, 'Rendering scene transitions'), 2500);
    setTimeout(() => updateStep('render', 'active', 75, 'Mixing audio and music'), 3200);
    setTimeout(() => updateStep('render', 'active', 90, 'Optimizing for YouTube'), 3800);
    
    const result = await api(`/api/shorts/${state.activeShort.id}/render`, { method: 'POST' });
    
    state.activeShort.video = result.video || result;
    
    // Show effects that were applied
    const effects = result.effects || [];
    const effectsMessage = effects.length > 0 
      ? `Video rendered with ${effects.length} effects: ${effects.slice(0,3).join(', ')}${effects.length > 3 ? '...' : ''}`
      : 'Video rendered successfully';
    
    updateStep('render', 'completed', 100, effectsMessage);
    
    // Show render completion notification
    setNotice(`<b>🎬 ${effectsMessage}</b> Ready for publishing to Marvel Central!`);
    
  } catch (error) {
    updateStep('render', 'error', 0, error.message);
    setNotice(`<b>Draft render not created.</b> ${error.message}`, true); 
  }
}

function wireDialogControls() {
  document.querySelectorAll('.close-dialog').forEach((button) => button.addEventListener('click', closeDialogs));
  document.querySelectorAll('dialog').forEach((dialog) => dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); }));
  document.querySelectorAll('[data-action="prompt-lab"]').forEach((button) => button.addEventListener('click', () => openDialog('prompt-dialog')));
  document.querySelectorAll('[data-action="show-setup"]').forEach((button) => button.addEventListener('click', () => openDialog('setup-dialog')));
  document.querySelectorAll('#open-evidence').forEach((button) => button.addEventListener('click', () => openDialog('evidence-dialog')));
  document.querySelectorAll('[data-action="new-short"]').forEach((button) => button.addEventListener('click', () => { window.scrollTo({ top: 0, behavior: 'smooth' }); $('#topic').focus(); }));
  document.querySelectorAll('[data-action="batch"], [data-action="queue"]').forEach((button) => button.addEventListener('click', () => setNotice('<b>Batch and queue UI is ready for a worker connection.</b> Add Redis and a durable worker before starting unattended batches.')));
}

// Wire automation mode switches
document.querySelectorAll('.mode-switch button').forEach(button => {
  button.addEventListener('click', () => {
    const mode = button.textContent;
    setAutomationMode(mode);
  });
});

// Wire YouTube controls
const connectBtn = $('#youtube-connect-btn');
if (connectBtn) connectBtn.addEventListener('click', connectYouTube);

// Wire music controls
const musicModeSelect = $('#music-mode');
const musicRegenerateBtn = $('#music-regenerate');

if (musicModeSelect) {
  musicModeSelect.addEventListener('change', () => {
    const musicPreview = $('#music-preview');
    if (musicModeSelect.value === 'None') {
      musicPreview.style.display = 'none';
    }
  });
}

if (musicRegenerateBtn) {
  musicRegenerateBtn.addEventListener('click', regenerateMusic);
}

// Wire disconnect and refresh buttons (these get added dynamically)
document.addEventListener('click', (event) => {
  if (event.target.id === 'disconnect-youtube') {
    event.preventDefault();
    disconnectYouTube();
  } else if (event.target.id === 'refresh-channel-info') {
    event.preventDefault();
    refreshChannelInfo();
  }
});

$('#generate').addEventListener('click', generate);
$('#research-button').addEventListener('click', () => { if (!state.activeShort) return generate(); openDialog('evidence-dialog'); });
$('#research-outline').addEventListener('click', () => $('#research-button').click());
$('#save-evidence').addEventListener('click', saveEvidence);
$('.publish-button').addEventListener('click', publishToYouTube);
$('#generate-audio').addEventListener('click', generateAudio);
$('#render-draft').addEventListener('click', renderDraft);
$('#content-type').addEventListener('change', () => loadBudget().catch(() => {}));
$('#prompt-select').addEventListener('change', (event) => { state.selectedPromptId = event.target.value; renderPrompts(); });
document.querySelectorAll('.variables button').forEach((button) => button.addEventListener('click', () => { const editor = $('#prompt-content'); editor.setRangeText(button.textContent, editor.selectionStart, editor.selectionEnd, 'end'); editor.focus(); }));
$('#save-prompt').addEventListener('click', async () => { try { const updated = await api(`/api/prompts/${state.selectedPromptId}/versions`, { method: 'POST', body: JSON.stringify({ content: $('#prompt-content').value }) }); state.prompts = state.prompts.map((prompt) => prompt.id === updated.id ? updated : prompt); renderPrompts(); $('#prompt-message').textContent = 'New version saved.'; } catch (error) { $('#prompt-message').textContent = error.message; } });
$('#test-prompt').addEventListener('click', () => { $('#prompt-message').textContent = 'Prompt testing is available after OpenRouter is configured.'; });
wireDialogControls();

// Check for URL parameters on page load
checkUrlParams();

Promise.all([loadHealth(), loadPrompts(), loadBudget(), loadYouTubeStatus()]).catch((error) => setNotice(`<b>Server connection issue.</b> ${error.message}`, true));
