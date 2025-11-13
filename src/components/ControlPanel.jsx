import React, { useState } from 'react'
import './ControlPanel.css'

function ControlPanel({
  badges,
  geofences,
  selectedBadge,
  onSelectBadge,
  onAddBadge,
  onUpdateRadius,
  onUpdateBadgePosition,
  onDeleteBadge,
  onAddGeofence,
  onDeleteGeofence,
  onLoadTestData,
  testMode,
  onToggleTestMode,
  showGeofences,
  onToggleGeofences,
  showBadges,
  onToggleBadges,
  showEventAnimations,
  onToggleEventAnimations,
  focusMode,
  onToggleFocusMode,
  focusedBadge,
  onSetFocusedBadge,
  onCenterMap,
  onFitToGeofences,
  onPublishToMqtt
}) {
  const [newBadgeMac, setNewBadgeMac] = useState('')
  const [newBadgeLat, setNewBadgeLat] = useState('28.594483408107756')
  const [newBadgeLon, setNewBadgeLon] = useState('77.20018682855103')
  const [newBadgeRadius, setNewBadgeRadius] = useState('20')
  const [showAddBadge, setShowAddBadge] = useState(false)
  const [showAddGeofence, setShowAddGeofence] = useState(false)

  const handleAddBadge = () => {
    if (newBadgeMac && newBadgeLat && newBadgeLon) {
      onAddBadge(
        newBadgeMac,
        parseFloat(newBadgeLat),
        parseFloat(newBadgeLon),
        newBadgeRadius ? parseFloat(newBadgeRadius) : null
      )
      setNewBadgeMac('')
      setShowAddBadge(false)
    }
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result)
          onLoadTestData(data)
        } catch (error) {
          alert('Error parsing JSON file: ' + error.message)
        }
      }
      reader.readAsText(file)
    }
  }

  // Convert LineString/MultiLineString to Polygon by closing the line
  const convertLineStringToPolygon = (geometry) => {
    if (geometry.type === 'LineString') {
      const coords = [...geometry.coordinates]
      // Close the line by adding the first point at the end
      if (coords.length > 0 && (coords[0][0] !== coords[coords.length - 1][0] || 
                                coords[0][1] !== coords[coords.length - 1][1])) {
        coords.push(coords[0])
      }
      return {
        type: 'Polygon',
        coordinates: [coords]
      }
    } else if (geometry.type === 'MultiLineString') {
      // Convert each LineString in MultiLineString to a polygon ring
      const polygons = geometry.coordinates.map(lineString => {
        const coords = [...lineString]
        // Close each line
        if (coords.length > 0 && (coords[0][0] !== coords[coords.length - 1][0] || 
                                   coords[0][1] !== coords[coords.length - 1][1])) {
          coords.push(coords[0])
        }
        return coords
      })
      // Use the first ring as outer boundary, others as holes (if any)
      return {
        type: 'Polygon',
        coordinates: polygons
      }
    }
    return geometry
  }

  const handleGeofenceFileUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const geojson = JSON.parse(event.target.result)
          
          // Handle different GeoJSON formats
          let features = []
          
          if (geojson.type === 'FeatureCollection') {
            features = geojson.features || []
          } else if (geojson.type === 'Feature') {
            features = [geojson]
          } else if (geojson.type === 'Polygon' || geojson.type === 'MultiPolygon' || 
                     geojson.type === 'LineString' || geojson.type === 'MultiLineString') {
            // Direct geometry object
            features = [{
              type: 'Feature',
              geometry: geojson,
              properties: {}
            }]
          } else if (geojson.polygon) {
            // Our custom format with polygon property
            features = [{
              type: 'Feature',
              geometry: geojson.polygon,
              properties: {
                name: geojson.name,
                mac: geojson.mac
              }
            }]
          } else if (Array.isArray(geojson)) {
            // Array of geofences
            geojson.forEach(item => {
              if (item.polygon) {
                features.push({
                  type: 'Feature',
                  geometry: item.polygon,
                  properties: {
                    name: item.name,
                    mac: item.mac
                  }
                })
              } else if (item.type === 'Feature') {
                features.push(item)
              }
            })
          }
          
          let importedCount = 0
          
          // Import each feature as a geofence
          features.forEach((feature, index) => {
            if (!feature.geometry) return
            
            const geomType = feature.geometry.type
            
            // Handle Polygon, MultiPolygon, LineString, and MultiLineString
            if (geomType === 'Polygon' || geomType === 'MultiPolygon' || 
                geomType === 'LineString' || geomType === 'MultiLineString') {
              
              // Convert LineString/MultiLineString to Polygon
              let polygonGeometry = feature.geometry
              if (geomType === 'LineString' || geomType === 'MultiLineString') {
                polygonGeometry = convertLineStringToPolygon(feature.geometry)
              }
              
              // Extract name from various possible properties
              const name = feature.properties?.boundary_name || 
                          feature.properties?.name || 
                          feature.properties?.label ||
                          feature.properties?.id || 
                          feature.id || 
                          `geofence_${index + 1}`
              
              const mac = feature.properties?.mac || null
              
              // Use stroke properties from GeoJSON if available
              const strokeColor = feature.properties?.stroke || null
              const strokeWidth = feature.properties?.['stroke-width'] || feature.properties?.strokeWidth || null
              const strokeOpacity = feature.properties?.['stroke-opacity'] || feature.properties?.strokeOpacity || null
              
              onAddGeofence(name, polygonGeometry, mac, strokeColor, strokeWidth, strokeOpacity)
              importedCount++
            }
          })
          
          if (importedCount === 0) {
            alert('No valid geofence geometries found in the file. Expected Polygon, MultiPolygon, LineString, or MultiLineString.')
          } else {
            alert(`Successfully imported ${importedCount} geofence(s)`)
            // Trigger auto-fit after import
            setTimeout(() => {
              if (onFitToGeofences) {
                onFitToGeofences()
              }
            }, 200)
          }
        } catch (error) {
          alert('Error parsing GeoJSON file: ' + error.message)
          console.error('GeoJSON parsing error:', error)
        }
      }
      reader.readAsText(file)
    }
    // Reset input so same file can be selected again
    e.target.value = ''
  }

  const handleExport = () => {
    const data = {
      badges: Array.from(badges.values()).map(b => ({
        mac: b.mac,
        latitude: b.latitude,
        longitude: b.longitude,
        radius: b.radius
      })),
      geofences: Array.from(geofences.values()).map(g => ({
        name: g.name,
        polygon: g.polygon,
        mac: g.mac
      }))
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'geofence-test-data.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportGeoJSON = () => {
    const features = Array.from(geofences.values()).map(g => ({
      type: 'Feature',
      properties: {
        name: g.name,
        ...(g.mac && { mac: g.mac }),
        ...(g.strokeColor && { stroke: g.strokeColor }),
        ...(g.strokeWidth && { 'stroke-width': g.strokeWidth }),
        ...(g.strokeOpacity !== null && g.strokeOpacity !== undefined && { 'stroke-opacity': g.strokeOpacity })
      },
      geometry: g.polygon
    }))

    const featureCollection = {
      type: 'FeatureCollection',
      features: features
    }

    const blob = new Blob([JSON.stringify(featureCollection, null, 2)], { type: 'application/geo+json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'geofences.geojson'
    a.click()
    URL.revokeObjectURL(url)
  }

  const selectedBadgeData = selectedBadge ? badges.get(selectedBadge) : null

  return (
    <div className="control-panel">
      <div className="panel-section">
        <h2>Controls</h2>
        
        <div className="control-group">
          <label>
            <input
              type="checkbox"
              checked={testMode}
              onChange={(e) => onToggleTestMode(e.target.checked)}
            />
            Test Mode
          </label>
        </div>

        <div className="control-group">
          <label>
            <input
              type="checkbox"
              checked={showBadges}
              onChange={(e) => onToggleBadges(e.target.checked)}
            />
            Show Badges
          </label>
        </div>

        <div className="control-group">
          <label>
            <input
              type="checkbox"
              checked={showGeofences}
              onChange={(e) => onToggleGeofences(e.target.checked)}
            />
            Show Geofences
          </label>
        </div>

        <div className="control-group">
          <label>
            <input
              type="checkbox"
              checked={showEventAnimations}
              onChange={(e) => onToggleEventAnimations(e.target.checked)}
            />
            Event Animations
          </label>
        </div>

        <div className="control-group">
          <label>
            <input
              type="checkbox"
              checked={focusMode}
              onChange={(e) => {
                onToggleFocusMode(e.target.checked)
                if (!e.target.checked) {
                  onSetFocusedBadge(null)
                } else if (selectedBadge) {
                  onSetFocusedBadge(selectedBadge)
                }
              }}
            />
            Focus Mode (Show Only Selected Badge)
          </label>
        </div>
      </div>

      <div className="panel-section">
        <h2>Badges ({badges.size})</h2>
        
        <div className="button-group">
          <button onClick={() => setShowAddBadge(!showAddBadge)}>
            {showAddBadge ? 'Cancel' : '+ Add Badge'}
          </button>
          <button onClick={handleExport}>Export Data</button>
          <label className="file-upload-button">
            Import Data
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
          </label>
        </div>

        {showAddBadge && (
          <div className="add-badge-form">
            <input
              type="text"
              placeholder="MAC Address"
              value={newBadgeMac}
              onChange={(e) => setNewBadgeMac(e.target.value)}
            />
            <input
              type="number"
              step="0.000001"
              placeholder="Latitude"
              value={newBadgeLat}
              onChange={(e) => setNewBadgeLat(e.target.value)}
            />
            <input
              type="number"
              step="0.000001"
              placeholder="Longitude"
              value={newBadgeLon}
              onChange={(e) => setNewBadgeLon(e.target.value)}
            />
            <input
              type="number"
              step="0.1"
              placeholder="Radius (feet, optional)"
              value={newBadgeRadius}
              onChange={(e) => setNewBadgeRadius(e.target.value)}
            />
            <button onClick={handleAddBadge}>Add</button>
          </div>
        )}

        <div className="badge-list">
          {Array.from(badges.entries()).map(([mac, badge]) => (
            <div
              key={mac}
              className={`badge-item ${selectedBadge === mac ? 'selected' : ''} ${focusedBadge === mac ? 'focused' : ''}`}
              onClick={() => {
                onSelectBadge(mac)
                if (focusMode) {
                  onSetFocusedBadge(mac)
                }
              }}
            >
              <div className="badge-header">
                <strong>{mac}</strong>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {focusMode && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (focusedBadge === mac) {
                          onSetFocusedBadge(null)
                          onToggleFocusMode(false)
                        } else {
                          onSetFocusedBadge(mac)
                          onSelectBadge(mac)
                        }
                      }}
                      className="focus-button"
                      title={focusedBadge === mac ? "Unfocus" : "Focus this badge"}
                    >
                      {focusedBadge === mac ? '👁️' : '👁️‍🗨️'}
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteBadge(mac)
                    }}
                    className="delete-button"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="badge-info">
                {badge.latitude?.toFixed(6)}, {badge.longitude?.toFixed(6)}
                {badge.radius && ` • ${badge.radius} ft`}
              </div>
              {selectedBadge === mac && (
                <div className="badge-controls">
                  <label>
                    Latitude:
                    <input
                      type="number"
                      step="0.000001"
                      value={badge.latitude || ''}
                      onChange={(e) => {
                        e.stopPropagation()
                        const lat = e.target.value ? parseFloat(e.target.value) : null
                        if (lat !== null && !isNaN(lat)) {
                          onUpdateBadgePosition(mac, lat, badge.longitude, badge.radius)
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </label>
                  <label>
                    Longitude:
                    <input
                      type="number"
                      step="0.000001"
                      value={badge.longitude || ''}
                      onChange={(e) => {
                        e.stopPropagation()
                        const lon = e.target.value ? parseFloat(e.target.value) : null
                        if (lon !== null && !isNaN(lon)) {
                          onUpdateBadgePosition(mac, badge.latitude, lon, badge.radius)
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </label>
                  <label>
                    Radius (feet):
                    <input
                      type="number"
                      step="0.1"
                      value={badge.radius || ''}
                      onChange={(e) => onUpdateRadius(mac, e.target.value ? parseFloat(e.target.value) : null)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </label>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (badge.latitude && badge.longitude) {
                        onCenterMap([badge.latitude, badge.longitude], 22)
                      }
                    }}
                  >
                    Center Map
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (badge.latitude && badge.longitude && badge.mac) {
                        onPublishToMqtt({
                          mac: badge.mac,
                          latitude: badge.latitude,
                          longitude: badge.longitude,
                          radius: badge.radius || null
                        })
                      }
                    }}
                    style={{ marginTop: '8px' }}
                  >
                    Publish to MQTT
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="panel-section">
        <h2>Geofences ({geofences.size})</h2>
        
        <div className="button-group">
          <button onClick={() => setShowAddGeofence(!showAddGeofence)}>
            {showAddGeofence ? 'Cancel' : '+ Add Geofence'}
          </button>
          <label className="file-upload-button">
            Import GeoJSON
            <input
              type="file"
              accept=".geojson,.json"
              onChange={handleGeofenceFileUpload}
              style={{ display: 'none' }}
            />
          </label>
          {geofences.size > 0 && (
            <>
              <button onClick={handleExportGeoJSON}>
                Export as GeoJSON
              </button>
              <button onClick={onFitToGeofences}>
                Fit to Geofences
              </button>
            </>
          )}
        </div>

        {showAddGeofence && (
          <div className="add-geofence-form">
            <p><strong>Import Geofences:</strong></p>
            <p>Click "Import GeoJSON" to load geofences from a .geojson file.</p>
            <p>Supported formats:</p>
            <ul style={{ fontSize: '0.85rem', marginLeft: '1.5rem', marginTop: '0.5rem' }}>
              <li>GeoJSON FeatureCollection</li>
              <li>GeoJSON Feature</li>
              <li>GeoJSON Polygon/MultiPolygon</li>
              <li>Array of geofences</li>
            </ul>
          </div>
        )}

        <div className="geofence-list">
          {Array.from(geofences.entries()).map(([name, geofence]) => (
            <div key={name} className="geofence-item">
              <div className="geofence-header">
                <strong>{name}</strong>
                <button
                  onClick={() => onDeleteGeofence(name)}
                  className="delete-button"
                >
                  ×
                </button>
              </div>
              {geofence.mac && <div className="geofence-info">MAC: {geofence.mac}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ControlPanel

