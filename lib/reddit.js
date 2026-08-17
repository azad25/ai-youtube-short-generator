// Reddit API integration for Marvel fact gathering
export class RedditService {
  constructor() {
    this.baseUrl = 'https://www.reddit.com/r';
    this.searchUrl = 'https://www.reddit.com/search.json';
    this.marvelSubreddits = [
      'marvelstudios',
      'Marvel',
      'MCU', 
      'marvelcomics',
      'MarvelTheories',
      'MarvelStudiosSpoilers'
    ];
  }

  async searchMarvelContent(query, options = {}) {
    const {
      subreddit = null,
      sort = 'top',
      time = 'year',
      limit = 10,
      minScore = 50
    } = options;

    try {
      let searchQuery = `${query} AND (Marvel OR MCU OR Avengers)`;
      let url;

      if (subreddit) {
        // Search within specific subreddit
        url = `${this.baseUrl}/${subreddit}/search.json?q=${encodeURIComponent(searchQuery)}&restrict_sr=on&sort=${sort}&t=${time}&limit=${limit}`;
      } else {
        // Search across all Marvel subreddits
        const subredditFilter = this.marvelSubreddits.map(sub => `subreddit:${sub}`).join(' OR ');
        searchQuery = `${query} AND (${subredditFilter})`;
        url = `${this.searchUrl}?q=${encodeURIComponent(searchQuery)}&sort=${sort}&t=${time}&limit=${limit * 2}`;
      }

      console.log(`🔍 Searching Reddit for: "${query}"`);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Marvel Shorts Factory Bot 1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`Reddit API error: ${response.status}`);
      }

      const data = await response.json();
      const posts = data.data?.children || [];

      // Filter and process posts
      const relevantPosts = posts
        .map(child => child.data)
        .filter(post => 
          post.score >= minScore &&
          !post.is_self || post.selftext?.length > 100 // Either link post or substantial text
        )
        .slice(0, limit);

      console.log(`📝 Found ${relevantPosts.length} relevant Reddit posts`);

      return relevantPosts.map(post => this.formatRedditPost(post));

    } catch (error) {
      console.error('Reddit search failed:', error);
      throw new Error(`Failed to search Reddit: ${error.message}`);
    }
  }

  formatRedditPost(post) {
    const isDiscussion = post.is_self;
    const hasContent = post.selftext && post.selftext.trim().length > 50;
    
    return {
      id: post.id,
      title: post.title,
      url: `https://reddit.com${post.permalink}`,
      subreddit: post.subreddit,
      author: post.author,
      score: post.score,
      created: new Date(post.created_utc * 1000).toISOString(),
      numComments: post.num_comments,
      content: hasContent ? post.selftext.substring(0, 500) + '...' : null,
      isDiscussion,
      flair: post.link_flair_text,
      type: this.categorizePost(post),
      reliability: this.assessReliability(post)
    };
  }

  categorizePost(post) {
    const title = post.title.toLowerCase();
    const flair = (post.link_flair_text || '').toLowerCase();
    
    if (flair.includes('spoiler') || title.includes('spoiler')) return 'spoiler';
    if (flair.includes('theory') || title.includes('theory')) return 'theory';
    if (flair.includes('leak') || title.includes('leak')) return 'leak';
    if (flair.includes('news') || title.includes('official')) return 'news';
    if (flair.includes('discussion')) return 'discussion';
    if (post.domain.includes('youtube.com') || post.domain.includes('twitter.com')) return 'media';
    
    return 'general';
  }

  assessReliability(post) {
    let score = 0;
    
    // Subreddit reliability
    const subreddit = post.subreddit.toLowerCase();
    if (['marvelstudios', 'marvel'].includes(subreddit)) score += 3;
    else if (['mcu', 'marvelcomics'].includes(subreddit)) score += 2;
    else if (['marveltheories', 'marvelspoilers'].includes(subreddit)) score += 1;
    
    // Post metrics
    if (post.score > 500) score += 2;
    else if (post.score > 100) score += 1;
    
    if (post.num_comments > 100) score += 1;
    
    // Flair/type
    const flair = (post.link_flair_text || '').toLowerCase();
    if (flair.includes('official') || flair.includes('news')) score += 3;
    else if (flair.includes('verified')) score += 2;
    else if (flair.includes('spoiler') || flair.includes('leak')) score -= 1;
    else if (flair.includes('theory')) score -= 2;
    
    // Author reputation (simplified)
    if (post.author === 'MarvelStudios' || post.author === 'Marvel') score += 5;
    
    return Math.max(0, Math.min(10, score)); // Scale 0-10
  }

  async generateFactsFromRedditPosts(posts, topic) {
    const facts = [];
    const sources = [];
    
    for (const post of posts) {
      // Create source entry
      const source = {
        id: `REDDIT-${post.id}`,
        title: post.title,
        url: post.url,
        tier: this.getSourceTier(post.reliability, post.type),
        type: 'Community',
        publishedAt: post.created,
        metadata: {
          subreddit: post.subreddit,
          score: post.score,
          comments: post.numComments,
          author: post.author,
          flair: post.flair,
          reliability: post.reliability
        }
      };
      
      sources.push(source);
      
      // Extract potential facts from post
      const extractedFacts = this.extractFactsFromPost(post, topic, source.id);
      facts.push(...extractedFacts);
    }
    
    return { sources, facts };
  }

  getSourceTier(reliability, type) {
    if (type === 'news' && reliability >= 7) return 1; // Tier 1: Official news
    if (type === 'news' && reliability >= 5) return 2; // Tier 2: Reliable news
    if (reliability >= 6 && type === 'discussion') return 2; // Tier 2: High-quality discussion
    if (type === 'spoiler' || type === 'leak') return 3; // Tier 3: Spoilers/leaks
    return 4; // Tier 4: General discussion/theories
  }

  extractFactsFromPost(post, topic, sourceId) {
    const facts = [];
    const topicLower = topic.toLowerCase();
    const titleLower = post.title.toLowerCase();
    
    // Extract facts based on post type and content
    if (post.type === 'news' && titleLower.includes(topicLower)) {
      facts.push({
        id: `FACT-REDDIT-${post.id}-1`,
        statement: `Reddit community discussion confirms details about ${topic}`,
        classification: this.getFactClassification(post.type, post.reliability),
        sourceIds: [sourceId],
        confidence: Math.min(0.9, post.reliability / 10)
      });
    }
    
    if (post.type === 'theory' && post.score > 200) {
      facts.push({
        id: `FACT-REDDIT-${post.id}-THEORY`,
        statement: `Community theory suggests ${topic} may have specific plot elements`,
        classification: 'THEORY',
        sourceIds: [sourceId],
        confidence: Math.min(0.7, post.score / 1000)
      });
    }
    
    if (post.type === 'spoiler' && post.reliability >= 5) {
      facts.push({
        id: `FACT-REDDIT-${post.id}-SPOILER`,
        statement: `Potential spoiler information about ${topic} from community sources`,
        classification: 'RUMORED',
        sourceIds: [sourceId],
        confidence: Math.min(0.8, post.reliability / 10)
      });
    }
    
    return facts;
  }

  getFactClassification(postType, reliability) {
    if (postType === 'news' && reliability >= 8) return 'CONFIRMED';
    if (postType === 'news' && reliability >= 6) return 'REPORTED';
    if (postType === 'spoiler' || postType === 'leak') return 'RUMORED';
    if (postType === 'theory') return 'THEORY';
    return 'REPORTED';
  }

  async searchMarvelFacts(topic, options = {}) {
    try {
      // Search across multiple subreddits
      const searchPromises = this.marvelSubreddits.slice(0, 3).map(subreddit =>
        this.searchMarvelContent(topic, { 
          subreddit, 
          limit: 3,
          minScore: 25,
          ...options 
        }).catch(err => {
          console.warn(`Search failed for r/${subreddit}:`, err.message);
          return [];
        })
      );
      
      const results = await Promise.all(searchPromises);
      const allPosts = results.flat();
      
      // Remove duplicates and sort by relevance
      const uniquePosts = this.deduplicatePosts(allPosts);
      const sortedPosts = uniquePosts.sort((a, b) => 
        (b.reliability * 10 + Math.log(b.score)) - (a.reliability * 10 + Math.log(a.score))
      );
      
      // Take top results
      const topPosts = sortedPosts.slice(0, options.maxPosts || 8);
      
      // Generate facts and sources
      return await this.generateFactsFromRedditPosts(topPosts, topic);
      
    } catch (error) {
      console.error('Reddit fact search failed:', error);
      throw new Error(`Reddit search failed: ${error.message}`);
    }
  }

  deduplicatePosts(posts) {
    const seen = new Set();
    return posts.filter(post => {
      const key = post.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

export const redditService = new RedditService();