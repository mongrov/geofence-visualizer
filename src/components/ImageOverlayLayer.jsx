import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'

function ImageOverlayLayer({ imageOverlays }) {
  const map = useMap()
  const overlaysRef = useRef(new Map()) // Store overlay instances by ID

  useEffect(() => {
    if (!map || !imageOverlays) return

    // Initialize map._imageOverlays if it doesn't exist
    if (!map._imageOverlays) {
      map._imageOverlays = {}
    }

    const currentOverlayIds = new Set()

    // Update or create overlays
    imageOverlays.forEach((overlay) => {
      if (!overlay.url || !overlay.bounds || !overlay.id) return

      currentOverlayIds.add(overlay.id)

      const bounds = [
        [overlay.bounds.south, overlay.bounds.west],
        [overlay.bounds.north, overlay.bounds.east]
      ]

      // Check if overlay already exists
      const existingOverlay = overlaysRef.current.get(overlay.id)
      
      if (existingOverlay) {
        // Update existing overlay
        try {
          existingOverlay.setBounds(bounds)
          existingOverlay.setOpacity(overlay.opacity || 0.7)
        } catch (error) {
          console.error('Error updating overlay:', error)
          // If update fails, remove and recreate
          map.removeLayer(existingOverlay)
          overlaysRef.current.delete(overlay.id)
          delete map._imageOverlays[overlay.id]
          
          // Create new overlay
          const imageOverlay = L.imageOverlay(overlay.url, bounds, {
            opacity: overlay.opacity || 0.7,
            interactive: overlay.interactive || false
          })
          imageOverlay.addTo(map)
          overlaysRef.current.set(overlay.id, imageOverlay)
          map._imageOverlays[overlay.id] = imageOverlay
        }
      } else {
        // Create new overlay
        const imageOverlay = L.imageOverlay(overlay.url, bounds, {
          opacity: overlay.opacity || 0.7,
          interactive: overlay.interactive || false
        })
        
        imageOverlay.addTo(map)
        overlaysRef.current.set(overlay.id, imageOverlay)
        map._imageOverlays[overlay.id] = imageOverlay
      }
    })

    // Remove overlays that no longer exist
    overlaysRef.current.forEach((overlay, id) => {
      if (!currentOverlayIds.has(id)) {
        map.removeLayer(overlay)
        overlaysRef.current.delete(id)
        if (map._imageOverlays) {
          delete map._imageOverlays[id]
        }
      }
    })

    // Cleanup function - only remove overlays if component unmounts
    return () => {
      // Don't remove overlays on every update, only on unmount
      // This is handled by the removal logic above
    }
  }, [map, imageOverlays])

  return null
}

export default ImageOverlayLayer

