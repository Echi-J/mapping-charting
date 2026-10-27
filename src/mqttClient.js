import mqtt from 'mqtt';
// Use your broker's WS or WSS endpoint:

const WS_PROTOCOL = location.protocol === 'https:' ? 'wss' : 'ws';
const BROKER_URL = `${WS_PROTOCOL}://mqtt.cetools.org:${WS_PROTOCOL === 'wss' ? 8081 : 8080}`;

const OPTIONS = {
  keepalive: 60,
  reconnectPeriod: 2000,
  connectTimeout: 30_000,
  clean: true
};

const client = mqtt.connect(BROKER_URL, OPTIONS);

client.on('connect', () => console.log('[MQTT] connected'));
client.on('reconnect', () => console.log('[MQTT] reconnecting...'));
client.on('error', err => console.error('[MQTT] error', err));

/**
 * Subscribe to all topics under a prefix.
 * Calls onMessage(Id, payloadString) whenever a message arrives.
 */
export function subscribe(prefix, onMessage) {
  const wildcard = `${prefix}/+`;
  client.subscribe(wildcard, err => {
    if (err) console.error('[MQTT] subscribe error', err);
    else console.log(`[MQTT] subscribed to ${wildcard}`);
  });

  client.on('message', (topic, payload) => {
    console.log('[MQTT RAW]', topic, payload.toString());

    if (!topic.startsWith(prefix + '/')) return;
    const Id = topic.split('/').pop();
    onMessage(Id, payload.toString());
  });
}

export default client;