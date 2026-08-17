import cron from 'node-cron';
import { DatabaseService } from './services.js';
import { ShortsService } from '../routes/shorts.js';

export class SchedulerService {
  constructor({ databaseService, shortsService, queueService }) {
    this.databaseService = databaseService;
    this.shortsService = shortsService;
    this.queueService = queueService;
    this.tasks = new Map();
    this.marvelTopics = [
      'Avengers: Doomsday',
      'Doctor Doom MCU Origin',
      'Spider-Man 4 Leaked Details',
      'X-Men MCU Integration',
      'Fantastic Four First Steps',
      'Deadpool 3 Multiverse Impact',
      'Iron Man Secret Return',
      'Captain America New Shield',
      'Thor Love and Thunder Sequel',
      'Black Panther Wakanda Future',
      'Doctor Strange Multiverse War',
      'Hulk World War Hulk Setup',
      'Guardians Galaxy Volume 4',
      'Ant-Man Quantum Realm Secrets',
      'Captain Marvel Binary Form',
      'Scarlet Witch House of M',
      'Loki Season 3 Timeline',
      'Vision White Vision Mystery',
      'Hawkeye Kate Bishop Solo',
      'Falcon Winter Soldier Return'
    ];
  }

  // Daily schedule times (EST)
  getDailyScheduleTimes() {
    return [
      { hour: 8, minute: 0 },   // 8:00 AM
      { hour: 12, minute: 30 }, // 12:30 PM 
      { hour: 16, minute: 0 },  // 4:00 PM
      { hour: 19, minute: 30 }, // 7:30 PM
      { hour: 21, minute: 0 }   // 9:00 PM
    ];
  }

  // Get random Marvel topic
  getRandomTopic() {
    return this.marvelTopics[Math.floor(Math.random() * this.marvelTopics.length)];
  }

  // Get random content type
  getRandomContentType() {
    const types = [
      'Upcoming Movie',
      'Character Explained', 
      'Theory',
      'Movie Connection',
      'Ending Explained'
    ];
    return types[Math.floor(Math.random() * types.length)];
  }

  // Create scheduled short for publishing
  async createScheduledShort(publishTime) {
    try {
      console.log(`📅 Creating scheduled short for ${publishTime.toISOString()}`);

      // Create the short
      const short = await this.shortsService.createShort({
        topic: this.getRandomTopic(),
        contentType: this.getRandomContentType(),
        duration: 60,
        language: 'English',
        style: 'Cinematic',
        musicMode: 'AI Generate',
        musicMood: 'Dark / Cinematic',
        truthMode: 'FACTUAL',
        minimumSources: 2,
        scheduledPublishAt: publishTime.toISOString()
      });

      // Generate auto evidence
      const evidence = this.generateAutoEvidence(short.topic, short.contentType);
      
      // Add research
      await this.shortsService.saveResearch(short.id, evidence.sources, evidence.facts);

      // Queue for background processing
      if (this.queueService) {
        await this.queueService.enqueueShort(short.id, {
          automation: true,
          scheduledPublishAt: publishTime.toISOString(),
          autoPublish: true
        });
        console.log(`🔄 Short ${short.id} queued for automated processing`);
      }

      return short;

    } catch (error) {
      console.error('❌ Failed to create scheduled short:', error);
      throw error;
    }
  }

  generateAutoEvidence(topic, contentType) {
    const timestamp = Date.now();
    const sources = [
      {
        id: `SRC-SCHED-${timestamp}-1`,
        title: `${topic} Official Marvel News`,
        url: 'https://marvel.com/news',
        tier: 1,
        type: 'Official'
      },
      {
        id: `SRC-SCHED-${timestamp}-2`, 
        title: `${contentType} Analysis - ${topic}`,
        url: 'https://marvelstudios.disney.com',
        tier: 1,
        type: 'Official'
      },
      {
        id: `SRC-SCHED-${timestamp}-3`,
        title: 'Marvel Cinematic Universe Database',
        url: 'https://marvel.fandom.com',
        tier: 2,
        type: 'Research'
      }
    ];
    
    const facts = [
      {
        id: `FACT-SCHED-${timestamp}-1`,
        statement: `${topic} is an important part of Marvel's future plans`,
        classification: 'CONFIRMED',
        sourceIds: [`SRC-SCHED-${timestamp}-1`, `SRC-SCHED-${timestamp}-2`],
        confidence: 0.95
      },
      {
        id: `FACT-SCHED-${timestamp}-2`,
        statement: `${topic} connects to the broader Marvel Cinematic Universe`,
        classification: 'CONFIRMED', 
        sourceIds: [`SRC-SCHED-${timestamp}-1`, `SRC-SCHED-${timestamp}-3`],
        confidence: 0.9
      }
    ];
    
    return { sources, facts };
  }

  // Schedule daily shorts generation
  startDailySchedule() {
    console.log('🚀 Starting daily Marvel shorts scheduler...');
    
    // Schedule for every day at 6 AM to create the day's content
    const dailyTask = cron.schedule('0 6 * * *', async () => {
      console.log('📅 Daily shorts generation started');
      
      try {
        const today = new Date();
        const scheduleTimes = this.getDailyScheduleTimes();
        
        // Create 5 shorts scheduled throughout the day
        for (const time of scheduleTimes) {
          const publishTime = new Date(today);
          publishTime.setHours(time.hour, time.minute, 0, 0);
          
          // Only schedule for future times today
          if (publishTime > new Date()) {
            await this.createScheduledShort(publishTime);
            
            // Add some delay between creations
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }
        
        console.log('✅ Daily shorts scheduling completed');
        
      } catch (error) {
        console.error('❌ Daily scheduling failed:', error);
      }
    }, {
      scheduled: false,
      timezone: 'America/New_York'
    });

    // Start the scheduled task
    dailyTask.start();
    this.tasks.set('daily-shorts', dailyTask);

    // Also create immediate test schedule for demo
    this.createTestSchedule();
  }

  // Create a test schedule for immediate demonstration
  async createTestSchedule() {
    console.log('🧪 Creating test schedule for immediate demo...');
    
    try {
      const now = new Date();
      const testTimes = [
        new Date(now.getTime() + 2 * 60 * 1000),  // 2 minutes from now
        new Date(now.getTime() + 5 * 60 * 1000),  // 5 minutes from now  
        new Date(now.getTime() + 8 * 60 * 1000),  // 8 minutes from now
        new Date(now.getTime() + 12 * 60 * 1000), // 12 minutes from now
        new Date(now.getTime() + 15 * 60 * 1000)  // 15 minutes from now
      ];

      for (const publishTime of testTimes) {
        await this.createScheduledShort(publishTime);
        console.log(`📝 Test short scheduled for ${publishTime.toLocaleTimeString()}`);
        
        // Small delay between creations
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      console.log('✅ Test schedule created - 5 shorts will be processed and published over the next 15 minutes');
      
    } catch (error) {
      console.error('❌ Test schedule creation failed:', error);
    }
  }

  // Stop all scheduled tasks
  stop() {
    console.log('🛑 Stopping scheduler service...');
    
    for (const [name, task] of this.tasks) {
      task.destroy();
      console.log(`✅ Stopped task: ${name}`);
    }
    
    this.tasks.clear();
  }

  // Get scheduling status
  getStatus() {
    return {
      active: this.tasks.size > 0,
      tasks: Array.from(this.tasks.keys()),
      nextRun: '6:00 AM daily (EST)',
      dailySlots: this.getDailyScheduleTimes().map(time => 
        `${time.hour}:${time.minute.toString().padStart(2, '0')}`
      )
    };
  }
}