import React, { useState } from 'react'
import './ImageOverlayManager.css'

function ImageOverlayManager({ imageOverlays, onAddOverlay, onDeleteOverlay, onUpdateOverlay, onGetCurrentBounds }) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingOverlay, setEditingOverlay] = useState(null)
  const [adjustStep, setAdjustStep] = useState(0.0001) // Default: ~11 meters
  const [imageFile, setImageFile] = useState(null)
  const [imageUrl, setImageUrl] = useState('')
  const [overlayName, setOverlayName] = useState('')
  const [south, setSouth] = useState('')
  const [north, setNorth] = useState('')
  const [west, setWest] = useState('')
  const [east, setEast] = useState('')
  const [opacity, setOpacity] = useState(0.7)
  const [positioningMode, setPositioningMode] = useState('manual') // 'manual', 'reference', 'click'

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onload = (event) => {
        setImageUrl(event.target.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleAdd = () => {
    if (!imageUrl || !overlayName) {
      alert('Please provide an image and name')
      return
    }

    if (positioningMode === 'manual') {
      if (!south || !north || !west || !east) {
        alert('Please provide all boundary coordinates')
        return
      }
    }

    const overlay = {
      id: Date.now(),
      name: overlayName,
      url: imageUrl,
      bounds: {
        south: parseFloat(south),
        north: parseFloat(north),
        west: parseFloat(west),
        east: parseFloat(east)
      },
      opacity: opacity
    }

    onAddOverlay(overlay)
    
    // Reset form
    setImageFile(null)
    setImageUrl('')
    setOverlayName('')
    setSouth('')
    setNorth('')
    setWest('')
    setEast('')
    setShowAddForm(false)
  }

  const handleUseCurrentView = () => {
    if (onGetCurrentBounds) {
      const bounds = onGetCurrentBounds()
      setSouth(bounds.south.toString())
      setNorth(bounds.north.toString())
      setWest(bounds.west.toString())
      setEast(bounds.east.toString())
    }
  }


  return (
    <div className="image-overlay-manager">
      <div className="image-overlay-header">
        <h3>Image Overlays ({imageOverlays.length})</h3>
        <div className="overlay-header-actions">
          <button onClick={() => setShowAddForm(!showAddForm)}>
            {showAddForm ? 'Cancel' : '+ Add Image'}
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="image-overlay-form">
          <div className="form-group">
            <label>Overlay Name:</label>
            <input
              type="text"
              value={overlayName}
              onChange={(e) => setOverlayName(e.target.value)}
              placeholder="e.g., Floor Plan, Diagram"
            />
          </div>

          <div className="form-group">
            <label>Image File:</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
            />
            {imageUrl && (
              <div className="image-preview">
                <img src={imageUrl} alt="Preview" />
                <div className="image-info">
                  {imageUrl.startsWith('data:') 
                    ? '✓ Image will be saved in configuration (embedded)'
                    : 'Image URL will be saved'}
                </div>
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Positioning Method:</label>
            <select
              value={positioningMode}
              onChange={(e) => setPositioningMode(e.target.value)}
            >
              <option value="manual">Manual Coordinates</option>
              <option value="reference">Use Reference Point</option>
              <option value="click">Click on Map (Coming Soon)</option>
            </select>
          </div>

          {positioningMode === 'manual' && (
            <>
              <div className="form-group">
                <label>Geographic Bounds:</label>
                <button 
                  type="button"
                  onClick={handleUseCurrentView}
                  className="get-bounds-button"
                >
                  Use Current Map View
                </button>
                <div className="bounds-inputs">
                  <div>
                    <label>South (Latitude):</label>
                    <input
                      type="number"
                      step="any"
                      value={south}
                      onChange={(e) => setSouth(e.target.value)}
                      placeholder="28.594"
                    />
                  </div>
                  <div>
                    <label>North (Latitude):</label>
                    <input
                      type="number"
                      step="any"
                      value={north}
                      onChange={(e) => setNorth(e.target.value)}
                      placeholder="28.595"
                    />
                  </div>
                  <div>
                    <label>West (Longitude):</label>
                    <input
                      type="number"
                      step="any"
                      value={west}
                      onChange={(e) => setWest(e.target.value)}
                      placeholder="77.200"
                    />
                  </div>
                  <div>
                    <label>East (Longitude):</label>
                    <input
                      type="number"
                      step="any"
                      value={east}
                      onChange={(e) => setEast(e.target.value)}
                      placeholder="77.201"
                    />
                  </div>
                </div>
                <div className="help-text">
                  <strong>How to find bounds:</strong>
                  <ul>
                    <li>Use existing badge/geofence coordinates as reference</li>
                    <li>Zoom to the area on the map, then estimate bounds</li>
                    <li>South &lt; North, West &lt; East</li>
                    <li>For a 2x2 grid diagram, estimate ~0.001° per rectangle</li>
                  </ul>
                </div>
              </div>
            </>
          )}

          {positioningMode === 'reference' && (
            <div className="form-group">
              <label>Reference Point (Center of Image):</label>
              <div className="reference-inputs">
                <div>
                  <label>Latitude:</label>
                  <input
                    type="number"
                    step="any"
                    value={south}
                    onChange={(e) => setSouth(e.target.value)}
                    placeholder="28.594483"
                  />
                </div>
                <div>
                  <label>Longitude:</label>
                  <input
                    type="number"
                    step="any"
                    value={west}
                    onChange={(e) => setWest(e.target.value)}
                    placeholder="77.200186"
                  />
                </div>
                <div>
                  <label>Image Width (degrees):</label>
                  <input
                    type="number"
                    step="any"
                    value={east}
                    onChange={(e) => setEast(e.target.value)}
                    placeholder="0.002"
                  />
                </div>
                <div>
                  <label>Image Height (degrees):</label>
                  <input
                    type="number"
                    step="any"
                    value={north}
                    onChange={(e) => setNorth(e.target.value)}
                    placeholder="0.002"
                  />
                </div>
              </div>
              <div className="help-text">
                <strong>Tip:</strong> Use a known badge location as center, then estimate image size.
                At zoom 19, ~0.001° ≈ 100 meters.
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Opacity: {opacity}</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={opacity}
              onChange={(e) => setOpacity(parseFloat(e.target.value))}
            />
          </div>

          <button className="add-button" onClick={handleAdd}>
            Add Image Overlay
          </button>
        </div>
      )}

      {/* Edit Form */}
      {editingOverlay && (
        <div className="image-overlay-edit-form">
          <div className="edit-form-header">
            <h4>Editing: {editingOverlay.name}</h4>
            <button onClick={() => setEditingOverlay(null)}>×</button>
          </div>
          
          <div className="realtime-bounds-editor">
            <div className="bounds-controls">
              <div className="bound-control">
                <label>South (Latitude):</label>
                <div className="bound-input-with-buttons">
                  <input
                    type="number"
                    step="0.000001"
                    value={editingOverlay.bounds.south}
                    onChange={(e) => {
                      const newBounds = { ...editingOverlay.bounds, south: parseFloat(e.target.value) || 0 }
                      const updated = { ...editingOverlay, bounds: newBounds }
                      setEditingOverlay(updated)
                      if (onUpdateOverlay) onUpdateOverlay(updated)
                    }}
                  />
                  <div className="adjust-buttons">
                    <button 
                      className="adjust-button"
                      onClick={() => {
                        const newBounds = { ...editingOverlay.bounds, south: editingOverlay.bounds.south - adjustStep }
                        const updated = { ...editingOverlay, bounds: newBounds }
                        setEditingOverlay(updated)
                        if (onUpdateOverlay) onUpdateOverlay(updated)
                      }}
                    >↓</button>
                    <button 
                      className="adjust-button"
                      onClick={() => {
                        const newBounds = { ...editingOverlay.bounds, south: editingOverlay.bounds.south + adjustStep }
                        const updated = { ...editingOverlay, bounds: newBounds }
                        setEditingOverlay(updated)
                        if (onUpdateOverlay) onUpdateOverlay(updated)
                      }}
                    >↑</button>
                  </div>
                </div>
              </div>
              
              <div className="bound-control">
                <label>North (Latitude):</label>
                <div className="bound-input-with-buttons">
                  <input
                    type="number"
                    step="0.000001"
                    value={editingOverlay.bounds.north}
                    onChange={(e) => {
                      const newBounds = { ...editingOverlay.bounds, north: parseFloat(e.target.value) || 0 }
                      const updated = { ...editingOverlay, bounds: newBounds }
                      setEditingOverlay(updated)
                      if (onUpdateOverlay) onUpdateOverlay(updated)
                    }}
                  />
                  <div className="adjust-buttons">
                    <button 
                      className="adjust-button"
                      onClick={() => {
                        const newBounds = { ...editingOverlay.bounds, north: editingOverlay.bounds.north - adjustStep }
                        const updated = { ...editingOverlay, bounds: newBounds }
                        setEditingOverlay(updated)
                        if (onUpdateOverlay) onUpdateOverlay(updated)
                      }}
                    >↓</button>
                    <button 
                      className="adjust-button"
                      onClick={() => {
                        const newBounds = { ...editingOverlay.bounds, north: editingOverlay.bounds.north + adjustStep }
                        const updated = { ...editingOverlay, bounds: newBounds }
                        setEditingOverlay(updated)
                        if (onUpdateOverlay) onUpdateOverlay(updated)
                      }}
                    >↑</button>
                  </div>
                </div>
              </div>
              
              <div className="bound-control">
                <label>West (Longitude):</label>
                <div className="bound-input-with-buttons">
                  <input
                    type="number"
                    step="0.000001"
                    value={editingOverlay.bounds.west}
                    onChange={(e) => {
                      const newBounds = { ...editingOverlay.bounds, west: parseFloat(e.target.value) || 0 }
                      const updated = { ...editingOverlay, bounds: newBounds }
                      setEditingOverlay(updated)
                      if (onUpdateOverlay) onUpdateOverlay(updated)
                    }}
                  />
                  <div className="adjust-buttons">
                    <button 
                      className="adjust-button"
                      onClick={() => {
                        const newBounds = { ...editingOverlay.bounds, west: editingOverlay.bounds.west - adjustStep }
                        const updated = { ...editingOverlay, bounds: newBounds }
                        setEditingOverlay(updated)
                        if (onUpdateOverlay) onUpdateOverlay(updated)
                      }}
                    >←</button>
                    <button 
                      className="adjust-button"
                      onClick={() => {
                        const newBounds = { ...editingOverlay.bounds, west: editingOverlay.bounds.west + adjustStep }
                        const updated = { ...editingOverlay, bounds: newBounds }
                        setEditingOverlay(updated)
                        if (onUpdateOverlay) onUpdateOverlay(updated)
                      }}
                    >→</button>
                  </div>
                </div>
              </div>
              
              <div className="bound-control">
                <label>East (Longitude):</label>
                <div className="bound-input-with-buttons">
                  <input
                    type="number"
                    step="0.000001"
                    value={editingOverlay.bounds.east}
                    onChange={(e) => {
                      const newBounds = { ...editingOverlay.bounds, east: parseFloat(e.target.value) || 0 }
                      const updated = { ...editingOverlay, bounds: newBounds }
                      setEditingOverlay(updated)
                      if (onUpdateOverlay) onUpdateOverlay(updated)
                    }}
                  />
                  <div className="adjust-buttons">
                    <button 
                      className="adjust-button"
                      onClick={() => {
                        const newBounds = { ...editingOverlay.bounds, east: editingOverlay.bounds.east - adjustStep }
                        const updated = { ...editingOverlay, bounds: newBounds }
                        setEditingOverlay(updated)
                        if (onUpdateOverlay) onUpdateOverlay(updated)
                      }}
                    >←</button>
                    <button 
                      className="adjust-button"
                      onClick={() => {
                        const newBounds = { ...editingOverlay.bounds, east: editingOverlay.bounds.east + adjustStep }
                        const updated = { ...editingOverlay, bounds: newBounds }
                        setEditingOverlay(updated)
                        if (onUpdateOverlay) onUpdateOverlay(updated)
                      }}
                    >→</button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="opacity-control">
              <label>Opacity: {editingOverlay.opacity.toFixed(1)}</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={editingOverlay.opacity}
                onChange={(e) => {
                  const updated = { ...editingOverlay, opacity: parseFloat(e.target.value) }
                  setEditingOverlay(updated)
                  if (onUpdateOverlay) onUpdateOverlay(updated)
                }}
              />
            </div>
            
            <div className="adjust-step-control">
              <label>Adjustment Step:</label>
              <select
                value={adjustStep}
                onChange={(e) => setAdjustStep(parseFloat(e.target.value))}
              >
                <option value="0.00001">Fine (0.00001° ≈ 1m)</option>
                <option value="0.00005">Medium (0.00005° ≈ 5m)</option>
                <option value="0.0001">Coarse (0.0001° ≈ 11m)</option>
                <option value="0.0005">Large (0.0005° ≈ 55m)</option>
              </select>
            </div>
            
            <div className="quick-adjust-buttons">
              <button 
                className="quick-adjust-btn"
                onClick={() => {
                  const bounds = onGetCurrentBounds()
                  const updated = { ...editingOverlay, bounds }
                  setEditingOverlay(updated)
                  if (onUpdateOverlay) onUpdateOverlay(updated)
                }}
              >
                Fit to Current View
              </button>
              <button 
                className="quick-adjust-btn"
                onClick={() => {
                  const centerLat = (editingOverlay.bounds.south + editingOverlay.bounds.north) / 2
                  const centerLon = (editingOverlay.bounds.west + editingOverlay.bounds.east) / 2
                  const width = editingOverlay.bounds.east - editingOverlay.bounds.west
                  const height = editingOverlay.bounds.north - editingOverlay.bounds.south
                  const scale = 1.1 // 10% larger
                  const updated = {
                    ...editingOverlay,
                    bounds: {
                      south: centerLat - (height * scale / 2),
                      north: centerLat + (height * scale / 2),
                      west: centerLon - (width * scale / 2),
                      east: centerLon + (width * scale / 2)
                    }
                  }
                  setEditingOverlay(updated)
                  if (onUpdateOverlay) onUpdateOverlay(updated)
                }}
              >
                Scale Up 10%
              </button>
              <button 
                className="quick-adjust-btn"
                onClick={() => {
                  const centerLat = (editingOverlay.bounds.south + editingOverlay.bounds.north) / 2
                  const centerLon = (editingOverlay.bounds.west + editingOverlay.bounds.east) / 2
                  const width = editingOverlay.bounds.east - editingOverlay.bounds.west
                  const height = editingOverlay.bounds.north - editingOverlay.bounds.south
                  const scale = 0.9 // 10% smaller
                  const updated = {
                    ...editingOverlay,
                    bounds: {
                      south: centerLat - (height * scale / 2),
                      north: centerLat + (height * scale / 2),
                      west: centerLon - (width * scale / 2),
                      east: centerLon + (width * scale / 2)
                    }
                  }
                  setEditingOverlay(updated)
                  if (onUpdateOverlay) onUpdateOverlay(updated)
                }}
              >
                Scale Down 10%
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="image-overlay-list">
        {imageOverlays.map((overlay) => (
          <div key={overlay.id} className="image-overlay-item">
            <div className="overlay-item-header">
              <span>{overlay.name}</span>
              <div className="overlay-item-actions">
                <button 
                  className="edit-button"
                  onClick={() => setEditingOverlay({ ...overlay })}
                  title="Edit bounds in real-time"
                >
                  ✏️ Edit
                </button>
                <button 
                  className="delete-button"
                  onClick={() => onDeleteOverlay(overlay.id)}
                >
                  ×
                </button>
              </div>
            </div>
            <div className="overlay-item-info">
              <div>Bounds: [{overlay.bounds.south.toFixed(6)}, {overlay.bounds.west.toFixed(6)}] to [{overlay.bounds.north.toFixed(6)}, {overlay.bounds.east.toFixed(6)}]</div>
              <div>Opacity: {overlay.opacity}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ImageOverlayManager

