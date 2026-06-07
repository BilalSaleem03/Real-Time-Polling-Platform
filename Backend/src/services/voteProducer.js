const { producer, connectProducer, isKafkaConnected } = require('../config/kafka');

// Send vote event to Kafka (non-blocking, fire-and-forget)
const sendVoteEvent = async (voteData) => {
  try {
    // Only try to send if producer is connected or can connect
    const connected = await connectProducer();
    if (!connected) {
      console.log('⚠️ Kafka not available, skipping event');
      return false;
    }
    
    await producer.send({
      topic: 'vote-events',
      messages: [
        {
          key: `poll-${voteData.pollId}`,
          value: JSON.stringify({
            ...voteData,
            processedAt: new Date().toISOString()
          }),
          timestamp: Date.now().toString()
        }
      ]
    });
    
    console.log(`📤 Vote event sent to Kafka for poll ${voteData.pollId}`);
    return true;
  } catch (error) {
    console.error('Failed to send vote event to Kafka:', error.message);
    return false; // Don't fail the main vote flow
  }
};

// Send batch of events (for future use)
const sendBatchVoteEvents = async (votes) => {
  try {
    const connected = await connectProducer();
    if (!connected) return false;
    
    const messages = votes.map(vote => ({
      key: `poll-${vote.pollId}`,
      value: JSON.stringify(vote),
      timestamp: Date.now().toString()
    }));
    
    await producer.send({
      topic: 'vote-events',
      messages
    });
    
    console.log(`📤 Batch of ${votes.length} vote events sent to Kafka`);
    return true;
  } catch (error) {
    console.error('Failed to send batch vote events:', error.message);
    return false;
  }
};

module.exports = { sendVoteEvent, sendBatchVoteEvents };