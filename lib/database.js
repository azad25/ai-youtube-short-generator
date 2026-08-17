import pg from 'pg';
const { Pool } = pg;

let pool = null;

export function getDb() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required for production database operations.');
    }
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

export async function initializeDatabase() {
  const db = getDb();
  
  // Create tables if they don't exist
  await db.query(`
    CREATE TABLE IF NOT EXISTS shorts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      topic VARCHAR(180) NOT NULL,
      content_type VARCHAR(50) NOT NULL,
      duration INTEGER NOT NULL CHECK (duration >= 10 AND duration <= 180),
      language VARCHAR(40) DEFAULT 'English',
      style VARCHAR(80) DEFAULT 'Cinematic',
      truth_mode VARCHAR(20) DEFAULT 'FACTUAL' CHECK (truth_mode IN ('FACTUAL', 'FACTUAL_REPORTED', 'THEORY', 'CREATIVE')),
      minimum_sources INTEGER DEFAULT 2 CHECK (minimum_sources >= 1 AND minimum_sources <= 5),
      status VARCHAR(30) DEFAULT 'DRAFT',
      script JSONB,
      assets JSONB DEFAULT '[]',
      audio JSONB,
      video JSONB,
      youtube JSONB,
      qa JSONB,
      budget_plan JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS sources (
      id VARCHAR(50) PRIMARY KEY,
      short_id UUID REFERENCES shorts(id) ON DELETE CASCADE,
      title VARCHAR(500) NOT NULL,
      url VARCHAR(1000) NOT NULL,
      tier INTEGER NOT NULL CHECK (tier IN (1, 2, 3, 4)),
      type VARCHAR(60) DEFAULT 'Reporting',
      published_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS facts (
      id VARCHAR(50) PRIMARY KEY,
      short_id UUID REFERENCES shorts(id) ON DELETE CASCADE,
      statement TEXT NOT NULL,
      classification VARCHAR(20) NOT NULL CHECK (classification IN ('CONFIRMED', 'REPORTED', 'RUMORED', 'THEORY', 'UNKNOWN', 'UNSUPPORTED')),
      source_ids JSONB NOT NULL DEFAULT '[]',
      confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      short_id UUID REFERENCES shorts(id) ON DELETE CASCADE,
      status VARCHAR(30) NOT NULL DEFAULT 'QUEUED',
      stage VARCHAR(30),
      progress INTEGER DEFAULT 0,
      attempts INTEGER DEFAULT 0,
      max_attempts INTEGER DEFAULT 3,
      error_message TEXT,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      started_at TIMESTAMP WITH TIME ZONE,
      completed_at TIMESTAMP WITH TIME ZONE
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS budget_tracking (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      operation VARCHAR(50) NOT NULL,
      provider VARCHAR(50) NOT NULL,
      model VARCHAR(100),
      cost DECIMAL(10,6) NOT NULL,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      short_id UUID REFERENCES shorts(id) ON DELETE SET NULL,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  // Create indexes for performance
  await db.query(`CREATE INDEX IF NOT EXISTS idx_shorts_status ON shorts(status);`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_shorts_created_at ON shorts(created_at DESC);`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_jobs_short_id ON jobs(short_id);`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_budget_tracking_created_at ON budget_tracking(created_at DESC);`);
}

export async function saveShort(short) {
  const db = getDb();
  const query = `
    INSERT INTO shorts (
      id, topic, content_type, duration, language, style, truth_mode, 
      minimum_sources, status, script, assets, audio, video, youtube, qa, budget_plan
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    ON CONFLICT (id) DO UPDATE SET
      topic = $2, content_type = $3, duration = $4, language = $5, style = $6,
      truth_mode = $7, minimum_sources = $8, status = $9, script = $10,
      assets = $11, audio = $12, video = $13, youtube = $14, qa = $15,
      budget_plan = $16, updated_at = NOW()
    RETURNING *;
  `;
  
  const values = [
    short.id, short.topic, short.contentType, short.duration, short.language,
    short.style, short.truthMode, short.minimumSources, short.status,
    JSON.stringify(short.script || null), JSON.stringify(short.assets || []),
    JSON.stringify(short.audio || null), JSON.stringify(short.video || null),
    JSON.stringify(short.youtube || null), JSON.stringify(short.qa || null),
    JSON.stringify(short.budgetPlan || null)
  ];
  
  const result = await db.query(query, values);
  return result.rows[0];
}

export async function getShorts(limit = 50) {
  const db = getDb();
  const result = await db.query(
    'SELECT * FROM shorts ORDER BY created_at DESC LIMIT $1',
    [limit]
  );
  return result.rows.map(normalizeShortRow);
}

export async function getShort(id) {
  const db = getDb();
  const result = await db.query('SELECT * FROM shorts WHERE id = $1', [id]);
  if (result.rows.length === 0) return null;
  
  const short = normalizeShortRow(result.rows[0]);
  
  // Load related sources and facts
  const sourcesResult = await db.query('SELECT * FROM sources WHERE short_id = $1', [id]);
  const factsResult = await db.query('SELECT * FROM facts WHERE short_id = $1', [id]);
  
  short.sources = sourcesResult.rows;
  short.facts = factsResult.rows.map(row => ({
    ...row,
    sourceIds: row.source_ids
  }));
  
  return short;
}

export async function saveSources(shortId, sources) {
  const db = getDb();
  
  try {
    console.log(`💾 Saving ${sources.length} sources for short ${shortId}:`, sources.map(s => s.id));
    
    // Delete existing sources for this short
    const deleteResult = await db.query('DELETE FROM sources WHERE short_id = $1', [shortId]);
    console.log(`🗑 Deleted ${deleteResult.rowCount} existing sources for short ${shortId}`);
    
    // Insert new sources
    for (const source of sources) {
      try {
        await db.query(
          'INSERT INTO sources (id, short_id, title, url, tier, type, published_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [source.id, shortId, source.title, source.url, source.tier, source.type, source.publishedAt]
        );
        console.log(`✅ Saved source ${source.id}: ${source.title}`);
      } catch (sourceError) {
        console.error(`❌ Failed to save source ${source.id}:`, sourceError.message);
        throw sourceError;
      }
    }
    
    console.log(`💾 Successfully saved all ${sources.length} sources for short ${shortId}`);
  } catch (error) {
    console.error(`❌ saveSources failed for short ${shortId}:`, error);
    throw error;
  }
}

export async function saveFacts(shortId, facts) {
  const db = getDb();
  
  try {
    console.log(`💾 Saving ${facts.length} facts for short ${shortId}:`, facts.map(f => f.id));
    
    // Delete existing facts for this short
    const deleteResult = await db.query('DELETE FROM facts WHERE short_id = $1', [shortId]);
    console.log(`🗑 Deleted ${deleteResult.rowCount} existing facts for short ${shortId}`);
    
    // Insert new facts
    for (const fact of facts) {
      try {
        await db.query(
          'INSERT INTO facts (id, short_id, statement, classification, source_ids, confidence) VALUES ($1, $2, $3, $4, $5, $6)',
          [fact.id, shortId, fact.statement, fact.classification, JSON.stringify(fact.sourceIds), fact.confidence]
        );
        console.log(`✅ Saved fact ${fact.id}: ${fact.statement.substring(0, 50)}...`);
      } catch (factError) {
        console.error(`❌ Failed to save fact ${fact.id}:`, factError.message);
        throw factError;
      }
    }
    
    console.log(`💾 Successfully saved all ${facts.length} facts for short ${shortId}`);
  } catch (error) {
    console.error(`❌ saveFacts failed for short ${shortId}:`, error);
    throw error;
  }
}

export async function recordBudgetUsage(operation, provider, cost, metadata = {}) {
  const db = getDb();
  await db.query(
    'INSERT INTO budget_tracking (operation, provider, model, cost, input_tokens, output_tokens, short_id, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    [operation, provider, metadata.model, cost, metadata.inputTokens || 0, metadata.outputTokens || 0, metadata.shortId, JSON.stringify(metadata)]
  );
}

export async function getBudgetSummary() {
  const db = getDb();
  const result = await db.query(`
    SELECT 
      COALESCE(SUM(cost), 0) as total_spent,
      COUNT(*) as total_operations,
      COUNT(DISTINCT short_id) as shorts_with_costs
    FROM budget_tracking 
    WHERE created_at >= NOW() - INTERVAL '3 months'
  `);
  
  return result.rows[0];
}

function normalizeShortRow(row) {
  return {
    id: row.id,
    topic: row.topic,
    contentType: row.content_type,
    duration: row.duration,
    language: row.language,
    style: row.style,
    truthMode: row.truth_mode,
    minimumSources: row.minimum_sources,
    status: row.status,
    script: row.script,
    assets: row.assets || [],
    audio: row.audio,
    video: row.video,
    youtube: row.youtube,
    qa: row.qa,
    budgetPlan: row.budget_plan,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}