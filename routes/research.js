import { json } from '../lib/middleware.js';
import { redditService } from '../lib/reddit.js';

export class ResearchService {
  constructor() {
    this.redditService = redditService;
  }

  async searchRedditFacts(topic, options = {}) {
    try {
      console.log(`🔍 Starting Reddit fact search for: "${topic}"`);
      
      const results = await this.redditService.searchMarvelFacts(topic, {
        maxPosts: options.maxPosts || 6,
        minScore: options.minScore || 30,
        time: options.timeframe || 'year',
        includeTheories: options.includeTheories !== false,
        includeSpoilers: options.includeSpoilers !== false
      });
      
      console.log(`📊 Reddit search completed:`, {
        sourcesFound: results.sources.length,
        factsGenerated: results.facts.length,
        topSubreddits: [...new Set(results.sources.map(s => s.metadata?.subreddit))].slice(0, 3)
      });
      
      return results;
      
    } catch (error) {
      console.error('Reddit fact search failed:', error);
      throw new Error(`Reddit research failed: ${error.message}`);
    }
  }

  async enhanceEvidence(existingSources, existingFacts, topic) {
    try {
      const redditResults = await this.searchRedditFacts(topic, {
        maxPosts: 4, // Supplement existing evidence
        minScore: 50  // Higher quality for enhancement
      });
      
      // Merge with existing evidence
      const allSources = [...existingSources, ...redditResults.sources];
      const allFacts = [...existingFacts, ...redditResults.facts];
      
      return {
        sources: allSources,
        facts: allFacts,
        enhancement: {
          redditSourcesAdded: redditResults.sources.length,
          redditFactsAdded: redditResults.facts.length,
          totalSources: allSources.length,
          totalFacts: allFacts.length
        }
      };
      
    } catch (error) {
      console.warn('Reddit enhancement failed:', error.message);
      // Return original evidence if Reddit enhancement fails
      return {
        sources: existingSources,
        facts: existingFacts,
        enhancement: { error: error.message }
      };
    }
  }

  async autoGenerateEvidence(topic, contentType, options = {}) {
    try {
      // Start with basic evidence
      const basicEvidence = this.generateBasicEvidence(topic, contentType);
      
      // Enhance with Reddit research if enabled
      if (options.includeReddit !== false) {
        const enhanced = await this.enhanceEvidence(
          basicEvidence.sources, 
          basicEvidence.facts, 
          topic
        );
        return enhanced;
      }
      
      return basicEvidence;
      
    } catch (error) {
      console.error('Auto evidence generation failed:', error);
      // Fallback to basic evidence
      return this.generateBasicEvidence(topic, contentType);
    }
  }

  generateBasicEvidence(topic, contentType) {
    const timestamp = Date.now();
    const sources = [
      {
        id: `SRC-BASIC-${timestamp}-1`,
        title: `${topic} Official Information`,
        url: 'https://marvel.com/news',
        tier: 1,
        type: 'Official'
      },
      {
        id: `SRC-BASIC-${timestamp}-2`,
        title: `${contentType} Database Entry`,
        url: 'https://marvelcinematicuniverse.fandom.com',
        tier: 2,
        type: 'Database'
      },
      {
        id: `SRC-BASIC-${timestamp}-3`,
        title: 'Marvel Studios Information',
        url: 'https://www.marvel.com/movies',
        tier: 1,
        type: 'Official'
      }
    ];

    const facts = [
      {
        id: `FACT-BASIC-${timestamp}-1`,
        statement: `${topic} is part of the Marvel Cinematic Universe`,
        classification: 'CONFIRMED',
        sourceIds: [`SRC-BASIC-${timestamp}-1`, `SRC-BASIC-${timestamp}-3`],
        confidence: 0.95
      },
      {
        id: `FACT-BASIC-${timestamp}-2`,
        statement: `${topic} has been officially announced or confirmed by Marvel Studios`,
        classification: 'CONFIRMED',
        sourceIds: [`SRC-BASIC-${timestamp}-1`, `SRC-BASIC-${timestamp}-3`],
        confidence: 0.9
      },
      {
        id: `FACT-BASIC-${timestamp}-3`,
        statement: `${contentType} content provides detailed information about ${topic}`,
        classification: 'REPORTED',
        sourceIds: [`SRC-BASIC-${timestamp}-2`],
        confidence: 0.8
      }
    ];

    return { sources, facts };
  }
}

// Route handlers
export async function searchRedditFactsHandler(request, response, { researchService }) {
  try {
    const { searchParams } = new URL(request.url, `http://${request.headers.host}`);
    const topic = searchParams.get('topic');
    
    if (!topic) {
      return json(response, 400, { error: 'Topic parameter is required' });
    }

    const options = {
      maxPosts: parseInt(searchParams.get('maxPosts')) || 6,
      minScore: parseInt(searchParams.get('minScore')) || 30,
      timeframe: searchParams.get('timeframe') || 'year',
      includeTheories: searchParams.get('includeTheories') !== 'false',
      includeSpoilers: searchParams.get('includeSpoilers') !== 'false'
    };

    const results = await researchService.searchRedditFacts(topic, options);
    return json(response, 200, results);

  } catch (error) {
    return json(response, 500, { error: error.message });
  }
}

export async function enhanceEvidenceHandler(request, response, { researchService, params }) {
  try {
    const { shortId } = params;
    const { searchParams } = new URL(request.url, `http://${request.headers.host}`);
    const topic = searchParams.get('topic');

    if (!topic) {
      return json(response, 400, { error: 'Topic parameter is required' });
    }

    // This would typically get existing evidence from the database
    // For now, we'll use basic evidence as the starting point
    const basicEvidence = researchService.generateBasicEvidence(topic, 'Upcoming Movie');
    
    const enhanced = await researchService.enhanceEvidence(
      basicEvidence.sources,
      basicEvidence.facts,
      topic
    );

    return json(response, 200, enhanced);

  } catch (error) {
    return json(response, 500, { error: error.message });
  }
}

export async function autoGenerateEvidenceHandler(request, response, { researchService }) {
  try {
    const { searchParams } = new URL(request.url, `http://${request.headers.host}`);
    const topic = searchParams.get('topic');
    const contentType = searchParams.get('contentType') || 'Upcoming Movie';
    
    if (!topic) {
      return json(response, 400, { error: 'Topic parameter is required' });
    }

    const options = {
      includeReddit: searchParams.get('includeReddit') !== 'false',
      maxPosts: parseInt(searchParams.get('maxPosts')) || 5,
      minScore: parseInt(searchParams.get('minScore')) || 40
    };

    const results = await researchService.autoGenerateEvidence(topic, contentType, options);
    return json(response, 200, results);

  } catch (error) {
    return json(response, 500, { error: error.message });
  }
}