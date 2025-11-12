# Image Overlay Positioning Guide

## Overview

This guide explains how to position image overlays (like floor plans, diagrams, or schematics) on the map so they align correctly with your geofences and badges.

## Understanding Geographic Bounds

An image overlay needs **4 coordinates** to position it on the map:
- **South** (Latitude): Bottom edge of the image
- **North** (Latitude): Top edge of the image  
- **West** (Longitude): Left edge of the image
- **East** (Longitude): Right edge of the image

**Important:** 
- South < North (south is always a smaller number)
- West < East (west is always a smaller number)

## Three Methods to Position Images

### Method 1: Use Current Map View (Easiest)

1. **Position your map** to show the area where your image should be placed
   - Zoom to the appropriate level
   - Pan to center the area
   - Make sure you can see where the image should align

2. **Click "+ Add Image"** in the Image Overlays section

3. **Select your image file**

4. **Choose "Manual Coordinates"** positioning method

5. **Click "Use Current Map View"** button
   - This automatically fills in the bounds based on what you see on the map
   - The image will cover exactly what's visible on your screen

6. **Adjust if needed:**
   - Fine-tune the coordinates manually
   - Adjust opacity to see through the image

### Method 2: Use Reference Point (For Known Locations)

If you know where the **center** of your image should be (e.g., a badge location):

1. **Find a reference point:**
   - Use an existing badge coordinate
   - Use a geofence corner
   - Use any known lat/lon point

2. **Select "Use Reference Point"** positioning method

3. **Enter the center coordinates:**
   - Latitude: Center point latitude
   - Longitude: Center point longitude

4. **Estimate image size:**
   - Image Width (degrees): How wide the image should be
   - Image Height (degrees): How tall the image should be

**Size Estimation Guide:**
- At zoom level 19: ~0.001° ≈ 100 meters
- At zoom level 20: ~0.0005° ≈ 50 meters
- At zoom level 21: ~0.00025° ≈ 25 meters

**Example:**
- Center: 28.594483, 77.200186 (known badge location)
- Image Width: 0.002° (≈ 200 meters at zoom 19)
- Image Height: 0.002° (≈ 200 meters at zoom 19)

### Method 3: Manual Coordinates (For Precise Control)

1. **Identify key points on your image:**
   - Find recognizable features (badges, geofences, corners)
   - Note their coordinates

2. **Calculate bounds:**
   - **South:** Lowest latitude point
   - **North:** Highest latitude point
   - **West:** Lowest longitude point
   - **East:** Highest longitude point

3. **Enter coordinates manually**

## Step-by-Step: Positioning Your Diagram Image

Based on your diagram showing a 2x2 grid with badges:

### Option A: If You Know Badge Locations

1. **Identify badge coordinates:**
   - Badge `08D1F9062F76`: Note its lat/lon
   - Badge `08D1F9062FAA`: Note its lat/lon
   - Badge `08F9E0C0B2FA`: Note its lat/lon

2. **Calculate the bounding box:**
   ```
   South = min(all badge latitudes) - buffer
   North = max(all badge latitudes) + buffer
   West = min(all badge longitudes) - buffer
   East = max(all badge longitudes) + buffer
   ```
   - Buffer: Add ~0.0005° (50m) on each side for padding

3. **Enter these bounds** in the form

### Option B: Use Map View (Recommended)

1. **Zoom to your badges** on the map
2. **Pan to show the area** your diagram represents
3. **Click "Use Current Map View"** - done!

### Option C: Estimate from Existing Geofences

If you have geofences that match your diagram:

1. **Find geofence coordinates** in the Control Panel
2. **Use geofence bounds** as a starting point
3. **Adjust to fit your image**

## Tips for Accurate Positioning

1. **Start with low opacity** (0.3-0.5) to see through the image
2. **Compare image features** with map features
3. **Adjust bounds incrementally** (0.0001° at a time)
4. **Use zoom level 19-20** for best precision
5. **Check alignment** with known badge/geofence positions

## Common Issues & Solutions

### Image is too small/large
- **Too small:** Increase the difference between North-South and East-West
- **Too large:** Decrease the difference between North-South and East-West

### Image is in wrong location
- **Shifted North/South:** Adjust both South and North by the same amount
- **Shifted East/West:** Adjust both West and East by the same amount

### Image is rotated/wrong orientation
- Leaflet ImageOverlay doesn't support rotation
- You may need to rotate your image file before uploading

### Can't see the image
- Check opacity (should be > 0)
- Verify bounds are correct (South < North, West < East)
- Make sure image file loaded successfully

## Example: Positioning a Floor Plan

**Scenario:** You have a floor plan image and know a badge is at `28.594483, 77.200186`

1. **Center the map** on `28.594483, 77.200186`
2. **Zoom to level 19** (appropriate for indoor tracking)
3. **Click "Use Current Map View"**
4. **Upload your floor plan image**
5. **Set opacity to 0.6** to see through it
6. **Fine-tune bounds** if needed:
   - If image extends too far north: decrease North value
   - If image is too far east: decrease East value
   - etc.

## Coordinate Reference

**Default map center:** `28.594483, 77.200186` (Delhi area)

**At zoom 19:**
- 1 degree latitude ≈ 111 km
- 0.001° ≈ 111 meters
- 0.0001° ≈ 11 meters

**For your 2x2 grid diagram:**
- If each rectangle is ~50m: use 0.0005° per rectangle
- Total width: ~0.001° (2 rectangles)
- Total height: ~0.001° (2 rectangles)

## Quick Reference

| Zoom Level | 1 degree | 0.001° | 0.0001° |
|------------|----------|--------|---------|
| 19         | 111 km   | 111 m  | 11 m    |
| 20         | 111 km   | 111 m  | 11 m    |
| 21         | 111 km   | 111 m  | 11 m    |

*Note: Longitude distance varies by latitude, but for Delhi area (~28°N), it's approximately the same as latitude.*

