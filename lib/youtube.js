import { google } from 'googleapis';
import { createReadStream } from 'node:fs';

export function youtubeClient() {
  if (!process.env.YOUTUBE_CLIENT_ID || !process.env.YOUTUBE_CLIENT_SECRET || !process.env.YOUTUBE_REDIRECT_URI) throw new Error('YouTube OAuth is not configured.');
  return new google.auth.OAuth2(process.env.YOUTUBE_CLIENT_ID, process.env.YOUTUBE_CLIENT_SECRET, process.env.YOUTUBE_REDIRECT_URI);
}

export function youtubeAuthorizationUrl(state) { 
  return youtubeClient().generateAuthUrl({ 
    access_type: 'offline', 
    prompt: 'consent', 
    scope: [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly'
    ], 
    state 
  }); 
}

export async function exchangeYoutubeCode(code) { 
  return youtubeClient().getToken(code); 
}

export async function getChannelInfo({ accessToken, refreshToken }) {
  const auth = youtubeClient();
  auth.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
  const youtube = google.youtube({ version: 'v3', auth });
  
  const response = await youtube.channels.list({
    part: ['snippet', 'statistics', 'brandingSettings'],
    mine: true
  });

  if (!response.data.items || response.data.items.length === 0) {
    throw new Error('No YouTube channel found for this account');
  }

  const channel = response.data.items[0];
  return {
    id: channel.id,
    title: channel.snippet.title,
    customUrl: channel.snippet.customUrl,
    description: channel.snippet.description,
    publishedAt: channel.snippet.publishedAt,
    thumbnails: channel.snippet.thumbnails,
    statistics: {
      viewCount: parseInt(channel.statistics.viewCount || '0'),
      subscriberCount: parseInt(channel.statistics.subscriberCount || '0'),
      videoCount: parseInt(channel.statistics.videoCount || '0'),
      hiddenSubscriberCount: channel.statistics.hiddenSubscriberCount
    },
    branding: {
      title: channel.brandingSettings?.channel?.title,
      description: channel.brandingSettings?.channel?.description,
      keywords: channel.brandingSettings?.channel?.keywords
    }
  };
}

export async function refreshAccessToken({ refreshToken }) {
  const auth = youtubeClient();
  auth.setCredentials({ refresh_token: refreshToken });
  
  try {
    const { credentials } = await auth.refreshAccessToken();
    return {
      accessToken: credentials.access_token,
      expiryDate: credentials.expiry_date,
      refreshToken: credentials.refresh_token || refreshToken // Keep existing if not provided
    };
  } catch (error) {
    throw new Error(`Failed to refresh YouTube access token: ${error.message}`);
  }
}

export async function uploadYoutubeShort({ accessToken, refreshToken, videoPath, title, description, tags, privacyStatus, publishAt }) {
  const auth = youtubeClient(); 
  auth.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
  
  try {
    const youtube = google.youtube({ version: 'v3', auth });
    
    // First, verify the channel info to ensure we're uploading to the right place
    const channelResponse = await youtube.channels.list({
      part: ['snippet'],
      mine: true
    });
    
    if (!channelResponse.data.items || channelResponse.data.items.length === 0) {
      throw new Error('No YouTube channel found for this account');
    }
    
    const channel = channelResponse.data.items[0];
    console.log(`Uploading to channel: ${channel.snippet.title} (${channel.id})`);
    
    const response = await youtube.videos.insert({ 
      part: ['snippet', 'status'], 
      requestBody: { 
        snippet: { 
          title, 
          description, 
          tags: Array.isArray(tags) ? tags : [tags].filter(Boolean),
          categoryId: '24' // Entertainment category
        }, 
        status: { 
          privacyStatus, 
          publishAt: publishAt || undefined, 
          selfDeclaredMadeForKids: false 
        } 
      }, 
      media: { body: createReadStream(videoPath) } 
    });
    
    const video = response.data;
    console.log(`Video uploaded successfully: ${video.id} to channel ${channel.snippet.title}`);
    
    return {
      ...video,
      channelInfo: {
        id: channel.id,
        title: channel.snippet.title
      }
    };
  } catch (error) {
    // Handle token expiration
    if (error.code === 401 || error.message.includes('Invalid Credentials')) {
      console.log('Access token expired, attempting to refresh...');
      const refreshed = await refreshAccessToken({ refreshToken });
      
      // Retry upload with new token
      return await uploadYoutubeShort({
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        videoPath,
        title,
        description,
        tags,
        privacyStatus,
        publishAt
      });
    }
    
    throw new Error(`YouTube upload failed: ${error.message}`);
  }
}
