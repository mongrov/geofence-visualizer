import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import mqtt from 'mqtt'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Try to load .env file if it exists
let envVars = {}
try {
  const envPath = join(__dirname, '..', '.env')
  const envContent = readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=')
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '')
      }
    }
  })
} catch (error) {
  // .env file doesn't exist, that's okay
}

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
})

app.use(cors())
app.use(express.json())

// MQTT Configuration
// These can be set via environment variables or .env file
const MQTT_BROKER_HOST = process.env.MQTT_BROKER_IN || envVars.MQTT_BROKER_IN || 'iot.mongrov.net'
const MQTT_BROKER_PORT = process.env.MQTT_BROKER_PORT || envVars.MQTT_BROKER_PORT || '1883'
const MQTT_BROKER_PROTOCOL = process.env.MQTT_BROKER_PROTOCOL || envVars.MQTT_BROKER_PROTOCOL || 'mqtt' // or 'mqtts' for TLS
const MQTT_BROKER = process.env.MQTT_BROKER || envVars.MQTT_BROKER || `${MQTT_BROKER_PROTOCOL}://${MQTT_BROKER_HOST}:${MQTT_BROKER_PORT}`
const MQTT_USERNAME = process.env.MQTT_USERNAME || envVars.MQTT_USERNAME || null
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || envVars.MQTT_PASSWORD || null
const MQTT_TOPIC_BADGES = process.env.MQTT_TOPIC_BADGES || envVars.MQTT_TOPIC_BADGES || 'old/assets/+/location'
const MQTT_TOPIC_GEOFENCE = process.env.MQTT_TOPIC_GEOFENCE || envVars.MQTT_TOPIC_GEOFENCE || 'geofence/+'

console.log('🔌 Connecting to MQTT broker:', MQTT_BROKER)
console.log('📡 Topics:', { badges: MQTT_TOPIC_BADGES, geofence: MQTT_TOPIC_GEOFENCE })

// Connect to MQTT broker
const mqttOptions = {
  clientId: `geofence-visualizer-${Math.random().toString(16).substr(2, 8)}`,
  reconnectPeriod: 5000,
  connectTimeout: 30000,
  keepalive: 60,
  clean: true
}

if (MQTT_USERNAME && MQTT_PASSWORD) {
  mqttOptions.username = MQTT_USERNAME
  mqttOptions.password = MQTT_PASSWORD
  console.log('🔐 Using MQTT authentication')
} else {
  console.log('🔓 No MQTT authentication (anonymous)')
}

const mqttClient = mqtt.connect(MQTT_BROKER, mqttOptions)

mqttClient.on('connect', () => {
  console.log('✅ Connected to MQTT broker:', MQTT_BROKER)
  
  // Subscribe to badge location updates
  mqttClient.subscribe(MQTT_TOPIC_BADGES, { qos: 0 }, (err) => {
    if (err) {
      console.error('❌ Error subscribing to badge topic:', err)
    } else {
      console.log(`✅ Subscribed to badge topic: ${MQTT_TOPIC_BADGES}`)
    }
  })
  
  // Subscribe to geofence events
  mqttClient.subscribe(MQTT_TOPIC_GEOFENCE, { qos: 0 }, (err) => {
    if (err) {
      console.error('❌ Error subscribing to geofence topic:', err)
    } else {
      console.log(`✅ Subscribed to geofence topic: ${MQTT_TOPIC_GEOFENCE}`)
    }
  })
})

mqttClient.on('error', (error) => {
  console.error('❌ MQTT error:', error)
})

mqttClient.on('close', () => {
  console.log('⚠️ MQTT connection closed')
})

mqttClient.on('reconnect', () => {
  console.log('🔄 Reconnecting to MQTT broker...')
})

mqttClient.on('offline', () => {
  console.log('⚠️ MQTT client is offline')
})

mqttClient.on('end', () => {
  console.log('⚠️ MQTT connection ended')
})

// Handle MQTT messages
mqttClient.on('message', (topic, message) => {
  try {
    console.log('Received MQTT message on topic:', topic)
    const messageStr = message.toString()
    console.log('Message content:', messageStr.substring(0, 200)) // Log first 200 chars
    
    const payload = JSON.parse(messageStr)
    
    // Extract MAC address from topic if needed
    // Topic format: old/assets/{mac}/location or geofence/{mac}
    const topicParts = topic.split('/')
    const mac = topicParts.length > 2 ? topicParts[topicParts.length - 2] : null
    
    if (topic.includes('location')) {
      // Badge location update - handle new payload format
      // Expected format: {"mac":"feed31446a32","latitude":28.594483408107756,"longitude":77.20018682855103,"radius":10.50,...}
      const badgeData = {
        mac: payload.mac || mac || payload.id || payload.device_id,
        latitude: payload.latitude !== undefined ? payload.latitude : (payload.lat !== undefined ? payload.lat : null),
        longitude: payload.longitude !== undefined ? payload.longitude : (payload.lon !== undefined ? payload.lon : null),
        radius: payload.radius !== undefined && payload.radius !== null ? payload.radius : null, // radius in feet (from payload)
        timestamp: payload.sent_ts || payload.receive_ts || payload.timestamp || new Date().toISOString(),
        // Additional metadata from payload
        device_id: payload.device_id || null,
        location_id: payload.location_id || null,
        floor: payload.floor || null,
        confidence: payload.confidence || null,
        map_view: payload.map_view || null,
        gateways: payload.gateways || []
      }
      
      console.log('Parsed badge data:', {
        mac: badgeData.mac,
        latitude: badgeData.latitude,
        longitude: badgeData.longitude,
        radius: badgeData.radius
      })
      
      // Only emit if we have valid coordinates and MAC
      if (badgeData.mac && badgeData.latitude !== null && badgeData.latitude !== undefined && 
          badgeData.longitude !== null && badgeData.longitude !== undefined) {
        console.log('Emitting badge_update to WebSocket clients')
        io.emit('badge_update', badgeData)
      } else {
        console.warn('Invalid badge data - missing mac, latitude, or longitude:', {
          mac: badgeData.mac,
          hasLat: badgeData.latitude !== undefined && badgeData.latitude !== null,
          hasLon: badgeData.longitude !== undefined && badgeData.longitude !== null
        })
      }
    } else if (topic.includes('geofence')) {
      // Geofence event
      const eventData = {
        ...payload,
        id: payload.id || mac || payload.mac,
        detect: payload.detect || payload.type,
        hook: payload.hook || topic,
        timestamp: payload.time || payload.timestamp || new Date().toISOString()
      }
      
      console.log('Emitting geofence_event to WebSocket clients')
      io.emit('geofence_event', eventData)
    }
  } catch (error) {
    console.error('Error parsing MQTT message:', error)
    console.error('Topic:', topic)
    console.error('Message:', message.toString())
  }
})

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id)
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id)
  })
  
  // Handle test badge updates (for manual testing)
  socket.on('test_badge_update', (data) => {
    // Forward test updates to other clients
    io.emit('badge_update', {
      ...data,
      timestamp: new Date().toISOString()
    })
  })
  
  // Handle geofence data requests
  socket.on('request_geofences', () => {
    // This could fetch geofences from a database or API
    // For now, clients can add geofences manually
    console.log('Geofence data requested')
  })
  
  // Handle badge location publish requests
  socket.on('publish_badge_location', (data) => {
    try {
      if (!mqttClient.connected) {
        console.error('❌ Cannot publish to MQTT: client not connected')
        socket.emit('publish_error', { error: 'MQTT client not connected' })
        return
      }
      
      const { mac, latitude, longitude, radius } = data
      
      if (!mac || latitude === null || latitude === undefined || 
          longitude === null || longitude === undefined) {
        console.error('❌ Invalid badge data for MQTT publish:', data)
        socket.emit('publish_error', { error: 'Invalid badge data: missing mac, latitude, or longitude' })
        return
      }
      
      // Construct MQTT topic: old/assets/{mac}/location
      const topic = `old/assets/${mac}/location`
      
      // Prepare payload matching the expected format
      const payload = {
        mac: mac,
        latitude: latitude,
        longitude: longitude,
        ...(radius !== null && radius !== undefined && { radius: radius }),
        sent_ts: new Date().toISOString(),
        timestamp: new Date().toISOString()
      }
      
      // Publish to MQTT
      mqttClient.publish(topic, JSON.stringify(payload), { qos: 0 }, (err) => {
        if (err) {
          console.error('❌ Error publishing to MQTT:', err)
          socket.emit('publish_error', { error: err.message })
        } else {
          console.log(`✅ Published badge location to MQTT topic: ${topic}`, payload)
          socket.emit('publish_success', { topic, payload })
        }
      })
    } catch (error) {
      console.error('❌ Error handling publish_badge_location:', error)
      socket.emit('publish_error', { error: error.message })
    }
  })
})

// REST API endpoints
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    mqtt: mqttClient.connected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  })
})

app.get('/api/config', (req, res) => {
  res.json({
    mqtt_broker: MQTT_BROKER,
    topics: {
      badges: MQTT_TOPIC_BADGES,
      geofence: MQTT_TOPIC_GEOFENCE
    }
  })
})

// Start server
const PORT = process.env.PORT || 3001
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  console.log(`WebSocket server ready for connections`)
})

