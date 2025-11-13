import React, { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import io from 'socket.io-client'
import './App.css'
import BadgeLayer from './components/BadgeLayer'
import GeofenceLayer from './components/GeofenceLayer'
import ControlPanel from './components/ControlPanel'
import EventLog from './components/EventLog'
import StatisticsPanel from './components/StatisticsPanel'
import Notification from './components/Notification'
import NotificationHistory from './components/NotificationHistory'
import ImageOverlayLayer from './components/ImageOverlayLayer'
import ImageOverlayManager from './components/ImageOverlayManager'

// Fix Leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

function MapUpdater({ center, zoom, preserveZoom = false, onMapReady }) {
  const map = useMap()
  useEffect(() => {
    if (center) {
      if (preserveZoom) {
        // Only update center, keep current zoom
        map.setView(center, map.getZoom(), { animate: true })
      } else {
        map.setView(center, zoom || map.getZoom())
      }
    }
  }, [center, zoom, map, preserveZoom])
  
  useEffect(() => {
    if (onMapReady && map) {
      onMapReady(map)
    }
  }, [map, onMapReady])
  
  return null
}

function App() {
  const [badges, setBadges] = useState(new Map())
  const [geofences, setGeofences] = useState(new Map())
  const [events, setEvents] = useState([])
  const [socket, setSocket] = useState(null)
  const [connected, setConnected] = useState(false)
  const [mapCenter, setMapCenter] = useState([28.594483408107756, 77.20018682855103]) // Default: Delhi area
  const [mapZoom, setMapZoom] = useState(19) // Appropriate zoom for indoor tracking
  const [selectedBadge, setSelectedBadge] = useState(null)
  const [testMode, setTestMode] = useState(false)
  const [showGeofences, setShowGeofences] = useState(true)
  const [showBadges, setShowBadges] = useState(true)
  const [showEventAnimations, setShowEventAnimations] = useState(true)
  const [focusMode, setFocusMode] = useState(false)
  const [focusedBadge, setFocusedBadge] = useState(null)
  const [notifications, setNotifications] = useState([]) // Popup notifications (auto-dismiss)
  const [notificationHistory, setNotificationHistory] = useState([]) // Persistent history
  const [showNotificationHistory, setShowNotificationHistory] = useState(false)
  const [imageOverlays, setImageOverlays] = useState(() => {
    // Load from localStorage on init
    try {
      const saved = localStorage.getItem('geofence-visualizer-image-overlays')
      if (saved) {
        const parsed = JSON.parse(saved)
        return Array.isArray(parsed) ? parsed : []
      }
    } catch (error) {
      console.error('Error loading image overlays from localStorage:', error)
    }
    return []
  })

  // Load geofences from localStorage on init
  useEffect(() => {
    try {
      const saved = localStorage.getItem('geofence-visualizer-geofences')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          const newGeofences = new Map()
          parsed.forEach(geofence => {
            if (geofence.name && geofence.polygon) {
              newGeofences.set(geofence.name, {
                name: geofence.name,
                polygon: geofence.polygon,
                mac: geofence.mac || null,
                strokeColor: geofence.strokeColor || null,
                strokeWidth: geofence.strokeWidth !== null && geofence.strokeWidth !== undefined ? geofence.strokeWidth : null,
                strokeOpacity: geofence.strokeOpacity !== null && geofence.strokeOpacity !== undefined ? geofence.strokeOpacity : null
              })
            }
          })
          if (newGeofences.size > 0) {
            setGeofences(newGeofences)
          }
        }
      }
    } catch (error) {
      console.error('Error loading geofences from localStorage:', error)
    }
  }, [])
  const mapRef = useRef(null)
  const eventsRef = useRef(events)

  useEffect(() => {
    eventsRef.current = events
  }, [events])

  useEffect(() => {
    // Connect to WebSocket server
    const newSocket = io('http://localhost:3001', {
      transports: ['websocket', 'polling']
    })

    newSocket.on('connect', () => {
      console.log('✅ Connected to WebSocket server')
      setConnected(true)
    })

    newSocket.on('disconnect', () => {
      console.log('⚠️ Disconnected from WebSocket server')
      setConnected(false)
    })

    newSocket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error)
    })

    newSocket.on('badge_update', (data) => {
      try {
        console.log('📨 Received badge_update from server:', data)
        const badge = typeof data === 'string' ? JSON.parse(data) : data
        const badgeKey = badge.mac || badge.id
        
        if (!badgeKey) {
          console.warn('⚠️ Badge update missing MAC address:', badge)
          return
        }
        
        setBadges(prev => {
          const newBadges = new Map(prev)
          const existing = newBadges.get(badgeKey) || { history: [] }
          
          // Extract coordinates - handle both formats
          const lat = badge.latitude !== undefined && badge.latitude !== null 
            ? badge.latitude 
            : badge.lat
          const lon = badge.longitude !== undefined && badge.longitude !== null 
            ? badge.longitude 
            : badge.lon
          
          // Only update if we have valid coordinates
          if (lat === undefined || lat === null || lon === undefined || lon === null) {
            console.warn('⚠️ Badge update missing coordinates:', { badge, lat, lon })
            return newBadges
          }
          
          // Radius is in feet from the payload
          const radius = badge.radius !== undefined && badge.radius !== null ? badge.radius : null
          
          console.log(`✅ Updating badge ${badgeKey}: lat=${lat}, lon=${lon}, radius=${radius}`)
          
          newBadges.set(badgeKey, {
            ...existing,
            ...badge,
            mac: badgeKey,
            latitude: lat,
            longitude: lon,
            radius: radius, // radius in feet
            timestamp: badge.timestamp || badge.sent_ts || badge.receive_ts || new Date().toISOString(),
            history: [...existing.history, {
              lat: lat,
              lon: lon,
              time: badge.timestamp || badge.sent_ts || badge.receive_ts || new Date().toISOString()
            }].slice(-50) // Keep last 50 positions
          })
          return newBadges
        })
      } catch (error) {
        console.error('❌ Error processing badge update:', error)
      }
    })

    newSocket.on('geofence_event', (data) => {
      try {
        const event = typeof data === 'string' ? JSON.parse(data) : data
        const newEvent = {
          ...event,
          id: event.id || event.mac,
          detect: event.detect || event.type,
          timestamp: event.time || event.timestamp || new Date().toISOString(),
          hook: event.hook || event.geofence_name
        }
        
        setEvents(prev => [newEvent, ...prev].slice(0, 100)) // Keep last 100 events

        // Extract geofence name from hook (format: geofence_{mac}_{boundary_name})
        let geofenceName = newEvent.hook || 'unknown'
        if (geofenceName.includes('_')) {
          const parts = geofenceName.split('_')
          if (parts.length >= 3) {
            geofenceName = parts.slice(2).join('_') // Get everything after geofence_{mac}_
          }
        }

        // Show notification for enter/exit events
        if (newEvent.detect === 'enter' || newEvent.detect === 'exit') {
          const badgeId = newEvent.id || 'unknown'
          const message = `geofence for badge "${badgeId}" on fence "${geofenceName}" had ${newEvent.detect}`
          
          const notificationId = Date.now() + Math.random()
          const timestamp = new Date().toISOString()
          
          // Add to popup notifications (auto-dismiss)
          setNotifications(prev => [...prev, {
            id: notificationId,
            message,
            type: newEvent.detect,
            timestamp
          }])
          
          // Add to persistent history
          setNotificationHistory(prev => [{
            id: notificationId,
            message,
            type: newEvent.detect,
            timestamp,
            badgeId,
            geofenceName
          }, ...prev].slice(0, 1000)) // Keep last 1000 events
        }

        // Update badge status based on event
        if (newEvent.id) {
          setBadges(prev => {
            const newBadges = new Map(prev)
            const badge = newBadges.get(newEvent.id)
            if (badge) {
              const status = badge.status || {}
              status[newEvent.hook] = newEvent.detect
              newBadges.set(newEvent.id, { ...badge, status, lastEvent: newEvent })
            }
            return newBadges
          })
        }
      } catch (error) {
        console.error('Error processing geofence event:', error)
      }
    })

    newSocket.on('geofence_data', (data) => {
      try {
        const geofence = typeof data === 'string' ? JSON.parse(data) : data
        const geofenceKey = geofence.name || geofence.hook || geofence.id
        setGeofences(prev => {
          const newGeofences = new Map(prev)
          newGeofences.set(geofenceKey, {
            ...geofence,
            name: geofenceKey,
            polygon: geofence.polygon || geofence.object || geofence.boundary,
            mac: geofence.mac || geofence.device_mac
          })
          return newGeofences
        })
      } catch (error) {
        console.error('Error processing geofence data:', error)
      }
    })

    newSocket.on('publish_success', (data) => {
      console.log('✅ Successfully published to MQTT:', data)
      const notificationId = Date.now() + Math.random()
      setNotifications(prev => [...prev, {
        id: notificationId,
        message: `Successfully published badge location to MQTT topic: ${data.topic}`,
        type: 'success',
        timestamp: new Date().toISOString()
      }])
    })

    newSocket.on('publish_error', (data) => {
      console.error('❌ Error publishing to MQTT:', data)
      const notificationId = Date.now() + Math.random()
      setNotifications(prev => [...prev, {
        id: notificationId,
        message: `Failed to publish to MQTT: ${data.error}`,
        type: 'error',
        timestamp: new Date().toISOString()
      }])
    })

    setSocket(newSocket)

    return () => {
      newSocket.close()
    }
  }, [])

  const handleMapClick = (e) => {
    if (testMode && selectedBadge) {
      const { lat, lng } = e.latlng
      const badge = badges.get(selectedBadge)
      if (badge) {
        setBadges(prev => {
          const newBadges = new Map(prev)
          newBadges.set(selectedBadge, {
            ...badge,
            latitude: lat,
            longitude: lng,
            timestamp: new Date().toISOString()
          })
          return newBadges
        })
        
        // Emit test update
        if (socket) {
          socket.emit('test_badge_update', {
            mac: selectedBadge,
            latitude: lat,
            longitude: lng,
            radius: badge.radius
          })
        }
      }
    }
  }

  const handleAddTestBadge = (mac, lat, lon, radius) => {
    setBadges(prev => {
      const newBadges = new Map(prev)
      newBadges.set(mac, {
        mac,
        latitude: lat,
        longitude: lon,
        radius: radius || null,
        timestamp: new Date().toISOString(),
        history: [],
        status: {}
      })
      return newBadges
    })
    setSelectedBadge(mac)
  }

  const handleUpdateBadgeRadius = (mac, radius) => {
    setBadges(prev => {
      const newBadges = new Map(prev)
      const badge = newBadges.get(mac)
      if (badge) {
        newBadges.set(mac, { ...badge, radius })
        if (socket) {
          socket.emit('test_badge_update', {
            mac,
            latitude: badge.latitude,
            longitude: badge.longitude,
            radius
          })
        }
      }
      return newBadges
    })
  }

  const handleUpdateBadgePosition = (mac, lat, lon, radius) => {
    setBadges(prev => {
      const newBadges = new Map(prev)
      const badge = newBadges.get(mac)
      if (badge) {
        const updatedBadge = {
          ...badge,
          latitude: lat !== null && lat !== undefined ? lat : badge.latitude,
          longitude: lon !== null && lon !== undefined ? lon : badge.longitude,
          radius: radius !== null && radius !== undefined ? radius : badge.radius,
          timestamp: new Date().toISOString()
        }
        newBadges.set(mac, updatedBadge)
        if (socket) {
          socket.emit('test_badge_update', {
            mac,
            latitude: updatedBadge.latitude,
            longitude: updatedBadge.longitude,
            radius: updatedBadge.radius
          })
        }
      }
      return newBadges
    })
  }

  const handleAddGeofence = (name, polygon, mac, strokeColor = null, strokeWidth = null, strokeOpacity = null) => {
    setGeofences(prev => {
      const newGeofences = new Map(prev)
      newGeofences.set(name, {
        name,
        polygon,
        mac: mac || null,
        strokeColor: strokeColor || null,
        strokeWidth: strokeWidth || null,
        strokeOpacity: strokeOpacity !== null ? strokeOpacity : null
      })
      
      // Auto-zoom to fit all geofences when first geofence is added
      if (prev.size === 0 && polygon && polygon.coordinates) {
        setTimeout(() => {
          const allGeofences = Array.from(newGeofences.values())
          if (allGeofences.length > 0) {
            const bounds = calculateGeofencesBounds(allGeofences)
            if (bounds) {
              setMapCenter([bounds.centerLat, bounds.centerLon])
              setMapZoom(Math.max(19, bounds.zoom)) // At least zoom 19 for indoor
            }
          }
        }, 100)
      }
      
      return newGeofences
    })
  }

  // Calculate bounds for all geofences to auto-fit the map
  const calculateGeofencesBounds = (geofences) => {
    if (!geofences || geofences.length === 0) return null
    
    let minLat = Infinity, maxLat = -Infinity
    let minLon = Infinity, maxLon = -Infinity
    
    geofences.forEach(geofence => {
      if (!geofence.polygon || !geofence.polygon.coordinates) return
      
      const coords = geofence.polygon.coordinates
      coords.forEach(ring => {
        ring.forEach(coord => {
          if (coord.length >= 2) {
            const lon = coord[0]
            const lat = coord[1]
            minLat = Math.min(minLat, lat)
            maxLat = Math.max(maxLat, lat)
            minLon = Math.min(minLon, lon)
            maxLon = Math.max(maxLon, lon)
          }
        })
      })
    })
    
    if (minLat === Infinity) return null
    
    const centerLat = (minLat + maxLat) / 2
    const centerLon = (minLon + maxLon) / 2
    
    // Calculate appropriate zoom level based on bounds
    const latDiff = maxLat - minLat
    const lonDiff = maxLon - minLon
    const maxDiff = Math.max(latDiff, lonDiff)
    
    // For indoor tracking, use appropriate zoom levels
    // Calculate zoom based on area size - smaller areas get higher zoom
    // Note: OSM tiles support up to zoom 19 natively, but we allow over-zooming up to 22
    let zoom = 20 // Default zoom for indoor areas
    
    // Scale zoom based on area coverage - smaller maxDiff = higher zoom
    if (maxDiff <= 0.0001) zoom = 21  // Very small (indoor room level)
    else if (maxDiff <= 0.0005) zoom = 20  // Small (indoor area)
    else if (maxDiff <= 0.001) zoom = 19   // Medium-small
    else if (maxDiff <= 0.002) zoom = 19   // Medium
    else if (maxDiff <= 0.005) zoom = 18   // Larger
    else if (maxDiff <= 0.01) zoom = 17    // Large
    else if (maxDiff <= 0.02) zoom = 16   // Very large
    else zoom = 15
    
    return {
      centerLat,
      centerLon,
      zoom: Math.min(21, Math.max(18, zoom)) // Clamp between 18-21 for indoor
    }
  }

  const handleDeleteBadge = (mac) => {
    setBadges(prev => {
      const newBadges = new Map(prev)
      newBadges.delete(mac)
      return newBadges
    })
    if (selectedBadge === mac) {
      setSelectedBadge(null)
    }
  }

  const handleDeleteGeofence = (name) => {
    setGeofences(prev => {
      const newGeofences = new Map(prev)
      newGeofences.delete(name)
      return newGeofences
    })
  }

  const handleLoadTestData = (data) => {
    if (data.badges) {
      const newBadges = new Map()
      data.badges.forEach(badge => {
        newBadges.set(badge.mac, {
          ...badge,
          history: [],
          status: {}
        })
      })
      setBadges(newBadges)
    }
    if (data.geofences) {
      const newGeofences = new Map()
      data.geofences.forEach(geofence => {
        // Handle LineString/MultiLineString in test data too
        let polygon = geofence.polygon
        if (polygon && (polygon.type === 'LineString' || polygon.type === 'MultiLineString')) {
          // Convert to polygon (this will be done in the import handler, but handle here too)
          const coords = polygon.type === 'LineString' 
            ? [polygon.coordinates]
            : polygon.coordinates
          const closedCoords = coords.map(line => {
            const closed = [...line]
            if (closed.length > 0 && (closed[0][0] !== closed[closed.length - 1][0] || 
                                      closed[0][1] !== closed[closed.length - 1][1])) {
              closed.push(closed[0])
            }
            return closed
          })
          polygon = {
            type: 'Polygon',
            coordinates: closedCoords
          }
        }
        newGeofences.set(geofence.name, {
          ...geofence,
          polygon: polygon || geofence.polygon
        })
      })
      setGeofences(newGeofences)
      
      // Auto-fit to geofences after loading
      setTimeout(() => {
        const allGeofences = Array.from(newGeofences.values())
        if (allGeofences.length > 0) {
          const bounds = calculateGeofencesBounds(allGeofences)
          if (bounds) {
            setMapCenter([bounds.centerLat, bounds.centerLon])
            setMapZoom(bounds.zoom)
          }
        }
      }, 100)
    }
  }

  const handleCloseNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const handleClearNotificationHistory = () => {
    if (window.confirm('Are you sure you want to clear all notification history?')) {
      setNotificationHistory([])
    }
  }

  // Save image overlays to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('geofence-visualizer-image-overlays', JSON.stringify(imageOverlays))
    } catch (error) {
      console.error('Error saving image overlays to localStorage:', error)
    }
  }, [imageOverlays])

  // Save geofences to localStorage whenever they change
  useEffect(() => {
    try {
      const geofencesArray = Array.from(geofences.values()).map(g => ({
        name: g.name,
        polygon: g.polygon,
        mac: g.mac || null,
        strokeColor: g.strokeColor || null,
        strokeWidth: g.strokeWidth !== null && g.strokeWidth !== undefined ? g.strokeWidth : null,
        strokeOpacity: g.strokeOpacity !== null && g.strokeOpacity !== undefined ? g.strokeOpacity : null
      }))
      localStorage.setItem('geofence-visualizer-geofences', JSON.stringify(geofencesArray))
    } catch (error) {
      console.error('Error saving geofences to localStorage:', error)
    }
  }, [geofences])

  const handleAddImageOverlay = (overlay) => {
    setImageOverlays(prev => [...prev, overlay])
  }

  const handleDeleteImageOverlay = (id) => {
    setImageOverlays(prev => prev.filter(o => o.id !== id))
  }

  const handleUpdateImageOverlay = (updatedOverlay) => {
    setImageOverlays(prev => prev.map(o => o.id === updatedOverlay.id ? updatedOverlay : o))
  }

  const handleExportImageOverlays = () => {
    // Export both image overlays and geofences
    const geofencesArray = Array.from(geofences.values()).map(g => ({
      name: g.name,
      polygon: g.polygon,
      mac: g.mac || null,
      strokeColor: g.strokeColor || null,
      strokeWidth: g.strokeWidth !== null && g.strokeWidth !== undefined ? g.strokeWidth : null,
      strokeOpacity: g.strokeOpacity !== null && g.strokeOpacity !== undefined ? g.strokeOpacity : null
    }))
    
    // Don't export if both arrays are empty
    if (imageOverlays.length === 0 && geofencesArray.length === 0) {
      alert('Nothing to export. Please add image overlays or geofences first.')
      return
    }
    
    const data = {
      imageOverlays: imageOverlays,
      geofences: geofencesArray,
      version: '1.0',
      exportedAt: new Date().toISOString()
    }
    
    const dataStr = JSON.stringify(data, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'geofence-visualizer-config.json'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleImportImageOverlays = (file) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result)
        
        // Handle new format with both imageOverlays and geofences
        let imageOverlaysData = null
        let geofencesData = null
        
        if (imported.imageOverlays || imported.geofences) {
          // New format: { imageOverlays: [...], geofences: [...] }
          imageOverlaysData = imported.imageOverlays
          geofencesData = imported.geofences
        } else if (Array.isArray(imported)) {
          // Old format: array of image overlays only
          imageOverlaysData = imported
        } else {
          alert('Invalid file format. Expected an object with imageOverlays and/or geofences, or an array of image overlays.')
          return
        }
        
        let importedCount = 0
        let geofencesCount = 0
        
        // Import image overlays
        if (imageOverlaysData && Array.isArray(imageOverlaysData)) {
          const validOverlays = imageOverlaysData.filter(o => 
            o.id && o.name && o.url && o.bounds && 
            o.bounds.south && o.bounds.north && o.bounds.west && o.bounds.east
          )
          
          if (validOverlays.length > 0) {
            const shouldReplace = window.confirm(
              `Found ${validOverlays.length} image overlay(s). Replace existing overlays? (Cancel to merge)`
            )
            
            if (shouldReplace) {
              setImageOverlays(validOverlays)
            } else {
              setImageOverlays(prev => {
                const existingIds = new Set(prev.map(o => o.id))
                const newOverlays = validOverlays.filter(o => !existingIds.has(o.id))
                return [...prev, ...newOverlays]
              })
            }
            importedCount = validOverlays.length
          }
        }
        
        // Import geofences
        if (geofencesData && Array.isArray(geofencesData)) {
          const validGeofences = geofencesData.filter(g => 
            g.name && g.polygon && g.polygon.type && g.polygon.coordinates
          )
          
          if (validGeofences.length > 0) {
            const shouldReplace = window.confirm(
              `Found ${validGeofences.length} geofence(s). Replace existing geofences? (Cancel to merge)`
            )
            
            setGeofences(prev => {
              const newGeofences = new Map(prev)
              
              if (shouldReplace) {
                newGeofences.clear()
              }
              
              validGeofences.forEach(geofence => {
                newGeofences.set(geofence.name, {
                  name: geofence.name,
                  polygon: geofence.polygon,
                  mac: geofence.mac || null,
                  strokeColor: geofence.strokeColor || null,
                  strokeWidth: geofence.strokeWidth !== null && geofence.strokeWidth !== undefined ? geofence.strokeWidth : null,
                  strokeOpacity: geofence.strokeOpacity !== null && geofence.strokeOpacity !== undefined ? geofence.strokeOpacity : null
                })
              })
              
              return newGeofences
            })
            geofencesCount = validGeofences.length
          }
        }
        
        if (importedCount === 0 && geofencesCount === 0) {
          alert('No valid image overlays or geofences found in the file')
        } else {
          const parts = []
          if (importedCount > 0) parts.push(`${importedCount} image overlay(s)`)
          if (geofencesCount > 0) parts.push(`${geofencesCount} geofence(s)`)
          alert(`Successfully imported ${parts.join(' and ')}`)
        }
      } catch (error) {
        console.error('Error importing configuration:', error)
        alert('Error importing file: ' + error.message)
      }
    }
    reader.readAsText(file)
  }

  const handleMapReady = (map) => {
    mapRef.current = map
  }

  const handleGetCurrentMapBounds = () => {
    if (mapRef.current) {
      const bounds = mapRef.current.getBounds()
      return {
        south: bounds.getSouth(),
        north: bounds.getNorth(),
        west: bounds.getWest(),
        east: bounds.getEast()
      }
    }
    
    // Fallback: estimate based on center and zoom
    const lat = mapCenter[0]
    const lon = mapCenter[1]
    const zoom = mapZoom
    
    const degreePerPixel = 360 / (256 * Math.pow(2, zoom))
    const width = degreePerPixel * 512
    const height = degreePerPixel * 512
    
    return {
      south: lat - height / 2,
      north: lat + height / 2,
      west: lon - width / 2,
      east: lon + width / 2
    }
  }

  return (
    <div className="app">
      {/* Notification Container */}
      <div className="notification-container">
        {notifications.map(notification => (
          <Notification
            key={notification.id}
            message={notification.message}
            type={notification.type}
            onClose={() => handleCloseNotification(notification.id)}
            duration={8000}
          />
        ))}
      </div>

      <header className="app-header">
        <h1>Geofence Visualization Tool</h1>
        <div className="header-actions">
          <button 
            className="notification-history-button"
            onClick={() => setShowNotificationHistory(!showNotificationHistory)}
            title="View notification history"
          >
            🔔 Notifications
            {notificationHistory.length > 0 && (
              <span className="notification-badge">{notificationHistory.length}</span>
            )}
          </button>
          <button 
            className="header-action-button"
            onClick={handleExportImageOverlays}
            title="Export image overlays and geofences (GeoJSON)"
          >
            💾 Export
          </button>
          <label className="header-action-button file-upload-label">
            📥 Import
            <input
              type="file"
              accept=".json"
              onChange={(e) => {
                const file = e.target.files[0]
                if (file && handleImportImageOverlays) {
                  handleImportImageOverlays(file)
                }
                e.target.value = '' // Reset file input
              }}
              style={{ display: 'none' }}
            />
          </label>
          <div className="connection-status">
            <span className={`status-indicator ${connected ? 'connected' : 'disconnected'}`}></span>
            <span>{connected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>
      </header>

      {/* Notification History Panel */}
      {showNotificationHistory && (
        <NotificationHistory
          notifications={notificationHistory}
          onClear={handleClearNotificationHistory}
          onClose={() => setShowNotificationHistory(false)}
        />
      )}
      
      <div className="app-content">
        <div className="sidebar">
          <ControlPanel
            badges={badges}
            geofences={geofences}
            selectedBadge={selectedBadge}
            onSelectBadge={setSelectedBadge}
            onAddBadge={handleAddTestBadge}
            onUpdateRadius={handleUpdateBadgeRadius}
            onUpdateBadgePosition={handleUpdateBadgePosition}
            onDeleteBadge={handleDeleteBadge}
            onAddGeofence={handleAddGeofence}
            onDeleteGeofence={handleDeleteGeofence}
            onLoadTestData={handleLoadTestData}
            testMode={testMode}
            onToggleTestMode={setTestMode}
            showGeofences={showGeofences}
            onToggleGeofences={setShowGeofences}
            showBadges={showBadges}
            onToggleBadges={setShowBadges}
            showEventAnimations={showEventAnimations}
            onToggleEventAnimations={setShowEventAnimations}
            focusMode={focusMode}
            onToggleFocusMode={(enabled) => {
              setFocusMode(enabled)
              if (!enabled) {
                setFocusedBadge(null)
              } else if (selectedBadge) {
                setFocusedBadge(selectedBadge)
                // Auto-center on focused badge (keep current zoom)
                const badge = badges.get(selectedBadge)
                if (badge && badge.latitude && badge.longitude) {
                  // Update center only, MapUpdater will preserve zoom when focusMode is true
                  setMapCenter([badge.latitude, badge.longitude])
                }
              }
            }}
            focusedBadge={focusedBadge}
            onSetFocusedBadge={(mac) => {
              setFocusedBadge(mac)
              if (mac) {
                // Auto-center on focused badge (keep current zoom)
                const badge = badges.get(mac)
                if (badge && badge.latitude && badge.longitude) {
                  // Update center only, MapUpdater will preserve zoom when focusMode is true
                  setMapCenter([badge.latitude, badge.longitude])
                }
              }
            }}
            onCenterMap={(center, zoom) => {
              setMapCenter(center)
              setMapZoom(zoom || mapZoom)
            }}
            onFitToGeofences={() => {
              const allGeofences = Array.from(geofences.values())
              if (allGeofences.length > 0) {
                const bounds = calculateGeofencesBounds(allGeofences)
                if (bounds) {
                  setMapCenter([bounds.centerLat, bounds.centerLon])
                  setMapZoom(bounds.zoom)
                }
              }
            }}
            onPublishToMqtt={(badgeData) => {
              if (socket && badgeData.mac && badgeData.latitude !== null && badgeData.longitude !== null) {
                socket.emit('publish_badge_location', badgeData)
                console.log('📤 Publishing badge location to MQTT:', badgeData)
              } else {
                console.warn('⚠️ Cannot publish to MQTT: missing socket connection or badge data')
                alert('Cannot publish to MQTT: Please ensure you are connected and the badge has valid coordinates.')
              }
            }}
          />
          
          <StatisticsPanel badges={badges} geofences={geofences} events={events} />
          
          <EventLog events={events} />
          
          <ImageOverlayManager
            imageOverlays={imageOverlays}
            onAddOverlay={handleAddImageOverlay}
            onDeleteOverlay={handleDeleteImageOverlay}
            onUpdateOverlay={handleUpdateImageOverlay}
            onGetCurrentBounds={handleGetCurrentMapBounds}
          />
        </div>

        <div className="map-container">
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            minZoom={15}
            maxZoom={22}
            zoomControl={true}
            style={{ height: '100%', width: '100%' }}
            onClick={handleMapClick}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={22}
              maxNativeZoom={19}
              zoomOffset={0}
            />
            <MapUpdater 
              center={mapCenter} 
              zoom={mapZoom} 
              preserveZoom={focusMode}
              onMapReady={handleMapReady}
            />
            
            {showGeofences && (
              <GeofenceLayer
                geofences={Array.from(geofences.values())}
                onDelete={handleDeleteGeofence}
              />
            )}
            
            {showBadges && (
              <BadgeLayer
                badges={focusMode && focusedBadge 
                  ? Array.from(badges.values()).filter(b => (b.mac || b.id) === focusedBadge)
                  : Array.from(badges.values())}
                selectedBadge={selectedBadge}
                onSelect={setSelectedBadge}
                showAnimations={showEventAnimations}
              />
            )}
            
            <ImageOverlayLayer imageOverlays={imageOverlays} />
          </MapContainer>
          
          {testMode && (
            <div className="test-mode-indicator">
              <span>Test Mode: Click on map to move selected badge</span>
            </div>
          )}
          
          {focusMode && focusedBadge && (
            <div className="focus-mode-indicator">
              <span>Focus Mode: Showing only badge {focusedBadge}</span>
              <button 
                onClick={() => {
                  setFocusMode(false)
                  setFocusedBadge(null)
                }}
                style={{
                  marginLeft: '10px',
                  padding: '4px 8px',
                  background: 'white',
                  color: '#1f2937',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                Exit Focus
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App

