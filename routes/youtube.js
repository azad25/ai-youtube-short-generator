import crypto from 'node:crypto';
import { json, body } from '../lib/middleware.js';
import { exchangeYoutubeCode, youtubeAuthorizationUrl, getChannelInfo, refreshAccessToken } from '../lib/youtube.js';

export class YouTubeService {
  constructor(stateManager) {
    this.stateManager = stateManager;
  }

  async getStatus() {
    const state = await this.stateManager.getState();
    const isConfigured = Boolean(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET);
    const isConnected = Boolean(state.youtube?.refreshToken);
    
    let channelInfo = null;
    if (isConnected && state.youtube?.channelInfo) {
      channelInfo = state.youtube.channelInfo;
    }
    
    return {
      configured: isConfigured,
      connected: isConnected,
      channelInfo
    };
  }

  async initiateOAuth() {
    if (!process.env.YOUTUBE_CLIENT_ID || !process.env.YOUTUBE_CLIENT_SECRET) {
      throw new Error('Configure YouTube OAuth credentials on the server first.');
    }

    const oauthState = crypto.randomUUID();
    const state = await this.stateManager.getState();
    state.youtube = { ...(state.youtube || {}), oauthState };
    await this.stateManager.saveState(state);

    return {
      authorizationUrl: youtubeAuthorizationUrl(oauthState)
    };
  }

  async handleCallback(code, stateParam) {
    const state = await this.stateManager.getState();
    
    if (!state.youtube?.oauthState || state.youtube.oauthState !== stateParam) {
      throw new Error('Invalid OAuth state.');
    }

    const result = await exchangeYoutubeCode(code);
    
    // Store tokens
    const youtubeData = {
      refreshToken: result.tokens.refresh_token || state.youtube.refreshToken,
      accessToken: result.tokens.access_token,
      expiryDate: result.tokens.expiry_date,
      connectedAt: new Date().toISOString()
    };

    try {
      // Fetch channel information
      const channelInfo = await getChannelInfo({
        accessToken: youtubeData.accessToken,
        refreshToken: youtubeData.refreshToken
      });

      youtubeData.channelInfo = channelInfo;
      state.youtube = youtubeData;
      
      await this.stateManager.saveState(state);
      return { success: true, channelInfo };
    } catch (error) {
      // Still save the connection even if channel info fails
      state.youtube = youtubeData;
      await this.stateManager.saveState(state);
      
      console.error('Failed to fetch channel info:', error);
      return { success: true, warning: 'Connected but could not fetch channel details' };
    }
  }

  async disconnect() {
    const state = await this.stateManager.getState();
    state.youtube = {};
    await this.stateManager.saveState(state);
    return { success: true };
  }

  async refreshAccessToken() {
    const state = await this.stateManager.getState();
    
    if (!state.youtube?.refreshToken) {
      throw new Error('YouTube not connected');
    }

    try {
      const { refreshAccessToken } = await import('../lib/youtube.js');
      const refreshed = await refreshAccessToken({
        refreshToken: state.youtube.refreshToken
      });

      // Update stored tokens
      state.youtube = {
        ...state.youtube,
        accessToken: refreshed.accessToken,
        expiryDate: refreshed.expiryDate,
        refreshToken: refreshed.refreshToken,
        lastRefresh: new Date().toISOString()
      };
      
      await this.stateManager.saveState(state);
      
      return { 
        success: true, 
        tokens: {
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken,
          expiryDate: refreshed.expiryDate
        }
      };
    } catch (error) {
      throw new Error(`Failed to refresh access token: ${error.message}`);
    }
  }

  async getUploadCredentials() {
    const state = await this.stateManager.getState();
    
    if (!state.youtube?.refreshToken) {
      throw new Error('YouTube not connected');
    }

    // Check if access token is expired (with 5 minute buffer)
    const now = new Date();
    const expiryDate = state.youtube.expiryDate ? new Date(state.youtube.expiryDate) : new Date(0);
    const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
    
    if (now.getTime() > (expiryDate.getTime() - bufferTime)) {
      console.log('Access token expired or expiring soon, refreshing...');
      const refreshResult = await this.refreshAccessToken();
      return {
        accessToken: refreshResult.tokens.accessToken,
        refreshToken: refreshResult.tokens.refreshToken
      };
    }

    return {
      accessToken: state.youtube.accessToken,
      refreshToken: state.youtube.refreshToken
    };
  }

  async refreshChannelInfo() {
    const state = await this.stateManager.getState();
    
    if (!state.youtube?.refreshToken || !state.youtube?.accessToken) {
      throw new Error('YouTube not connected');
    }

    try {
      const channelInfo = await getChannelInfo({
        accessToken: state.youtube.accessToken,
        refreshToken: state.youtube.refreshToken
      });

      state.youtube.channelInfo = channelInfo;
      state.youtube.lastRefresh = new Date().toISOString();
      await this.stateManager.saveState(state);
      
      return { success: true, channelInfo };
    } catch (error) {
      throw new Error(`Failed to refresh channel info: ${error.message}`);
    }
  }
}

export async function getYouTubeStatusHandler(request, response, { youtubeService }) {
  try {
    const status = await youtubeService.getStatus();
    return json(response, 200, status);
  } catch (error) {
    return json(response, 500, { error: error.message });
  }
}

export async function connectYouTubeHandler(request, response, { youtubeService }) {
  try {
    const result = await youtubeService.initiateOAuth();
    return json(response, 200, result);
  } catch (error) {
    return json(response, 503, { error: error.message });
  }
}

export async function youtubeCallbackHandler(request, response, { youtubeService, query }) {
  try {
    const result = await youtubeService.handleCallback(query.code, query.state);
    
    // Redirect to main page with success or warning
    const redirectUrl = new URL('/', `http://${request.headers.host}`);
    if (result.warning) {
      redirectUrl.searchParams.set('youtube_warning', result.warning);
    } else {
      redirectUrl.searchParams.set('youtube_success', 'connected');
    }
    
    response.writeHead(302, { Location: redirectUrl.toString() });
    response.end();
  } catch (error) {
    console.error('YouTube callback error:', error);
    const redirectUrl = new URL('/', `http://${request.headers.host}`);
    redirectUrl.searchParams.set('youtube_error', error.message);
    response.writeHead(302, { Location: redirectUrl.toString() });
    response.end();
  }
}

export async function disconnectYouTubeHandler(request, response, { youtubeService }) {
  try {
    const result = await youtubeService.disconnect();
    return json(response, 200, result);
  } catch (error) {
    return json(response, 500, { error: error.message });
  }
}

export async function refreshChannelInfoHandler(request, response, { youtubeService }) {
  try {
    const result = await youtubeService.refreshChannelInfo();
    return json(response, 200, result);
  } catch (error) {
    return json(response, 500, { error: error.message });
  }
}

export async function refreshAccessTokenHandler(request, response, { youtubeService }) {
  try {
    const result = await youtubeService.refreshAccessToken();
    return json(response, 200, { 
      success: true, 
      message: 'Access token refreshed successfully',
      expiresAt: result.tokens.expiryDate
    });
  } catch (error) {
    return json(response, 500, { error: error.message });
  }
}