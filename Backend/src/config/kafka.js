const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'polling-platform',
  brokers: ['localhost:9092'],
  retry: {
    initialRetryTime: 100,
    retries: 3,
    maxRetryTime: 5000
  },
  connectionTimeout: 5000,
  requestTimeout: 30000
});

const producer = kafka.producer({
  allowAutoTopicCreation: true,
  transactionTimeout: 30000
});

const consumer = kafka.consumer({ 
  groupId: 'polling-analytics-group',
  sessionTimeout: 30000,
  heartbeatInterval: 3000,
  maxBytesPerPartition: 1048576,
  allowAutoTopicCreation: true,
  retry: {
    maxRetryTime: 10000,
    initialRetryTime: 100,
    retries: 5,
    factor: 2,
    multiplier: 1.5
  }
});

let isProducerConnected = false;
let isConsumerConnected = false;

// Connect producer
const connectProducer = async () => {
  try {
    if (!isProducerConnected) {
      await producer.connect();
      isProducerConnected = true;
      console.log('✅ Kafka Producer connected');
      
      // Create topic if not exists
      const admin = kafka.admin();
      await admin.connect();
      const topics = await admin.listTopics();
      if (!topics.includes('vote-events')) {
        await admin.createTopics({
          topics: [{
            topic: 'vote-events',
            numPartitions: 1,
            replicationFactor: 1
          }]
        });
        console.log('✅ Created vote-events topic');
      }
      await admin.disconnect();
    }
    return true;
  } catch (error) {
    console.error('❌ Failed to connect Kafka producer:', error.message);
    return false;
  }
};

// Connect consumer
const connectConsumer = async () => {
  try {
    if (!isConsumerConnected) {
      await consumer.connect();
      isConsumerConnected = true;
      console.log('✅ Kafka Consumer connected');
    }
    return true;
  } catch (error) {
    console.error('❌ Failed to connect Kafka consumer:', error.message);
    return false;
  }
};

// Disconnect all
const disconnectKafka = async () => {
  try {
    if (isProducerConnected) {
      await producer.disconnect();
      isProducerConnected = false;
    }
    if (isConsumerConnected) {
      await consumer.disconnect();
      isConsumerConnected = false;
    }
    console.log('❌ Kafka disconnected');
  } catch (error) {
    console.error('Error disconnecting Kafka:', error);
  }
};

// Check connection status
const isKafkaConnected = () => {
  return isProducerConnected && isConsumerConnected;
};

module.exports = {
  kafka,
  producer,
  consumer,
  connectProducer,
  connectConsumer,
  disconnectKafka,
  isKafkaConnected
};